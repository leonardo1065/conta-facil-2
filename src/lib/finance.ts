import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, addMonths, currentMonthRef, lastDayOfMonth, monthRef, todayISO } from "./dates";

export type EntryKind = "despesa" | "receita";
export type EntryStatus = "pendente" | "pago";

export type Category = {
  id: string;
  user_id: string;
  name: string;
  kind: EntryKind;
  color: string;
  icon: string;
  recurrence_mode: "nenhuma" | "mensal" | "semanal" | "parcelada";
  recurrence_interval: number;
  recurrence_count: number | null;
};

export type Entry = {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  due_date: string;
  category_id: string | null;
  kind: EntryKind;
  status: EntryStatus;
  paid_at: string | null;
  notes: string | null;
  attachment_path: string | null;
  barcode: string | null;
  series_id: string | null;
  is_recurring: boolean;
  recurrence_interval_months: number;
  recurrence_unit: "mes" | "semana";
  installment_no: number | null;
  installment_total: number | null;
  is_avulsa: boolean;
  month_ref: string | null;
};

/**
 * Dois modos:
 * - "recorrente": cria apenas UM lançamento. Ao marcar como pago, o próximo
 *   período é gerado automaticamente com valor zerado (conta variável).
 * - "parcelada": gera todas as parcelas de uma vez, com o mesmo valor.
 */
export type Recurrence = {
  mode: "nenhuma" | "recorrente" | "parcelada" | "avulsa";
  frequency: "diaria" | "semanal" | "mensal" | "personalizada";
  interval: number;
  count: number;
  intervalMonths: number;
  unit: "mes" | "semana";
};


export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });
}

export function useEntries() {
  return useQuery({
    queryKey: ["entries"],
    queryFn: async (): Promise<Entry[]> => {
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((e) => ({ ...e, amount: Number(e.amount) })) as Entry[];
    },
  });
}

function nextDate(date: string, r: Recurrence, step: number): string {
  switch (r.frequency) {
    case "diaria":
      return addDays(date, step);
    case "semanal":
      return addDays(date, step * 7);
    case "mensal":
      return addMonths(date, step);
    case "personalizada":
      return addDays(date, step * Math.max(1, r.interval));
    default:
      return date;
  }
}

export type EntryInput = Omit<
  Entry,
  | "id"
  | "user_id"
  | "is_recurring"
  | "recurrence_interval_months"
  | "recurrence_unit"
  | "installment_no"
  | "installment_total"
  | "is_avulsa"
  | "month_ref"
> & { recurrence?: Recurrence };


export function useSaveEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: EntryInput }) => {
      const { recurrence, ...base } = values;
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada");

      if (id) {
        const { error } = await supabase.from("entries").update(base).eq("id", id);
        if (error) throw error;
        return;
      }

      const mode = recurrence?.mode ?? "nenhuma";

      // Conta avulsa: um único lançamento por mês, que acumula os valores
      // lançados e recomeça do zero quando vira o mês (dia 1º).
      if (mode === "avulsa") {
        const ref = monthRef(base.due_date);
        const { error } = await supabase.from("entries").insert({
          ...base,
          due_date: lastDayOfMonth(base.due_date),
          user_id: userId,
          series_id: crypto.randomUUID(),
          is_recurring: false,
          is_avulsa: true,
          month_ref: ref,
          recurrence_interval_months: 1,
          recurrence_unit: "mes",
          installment_no: null,
          installment_total: null,
        });
        if (error) throw error;
        return;
      }

      // Conta que se repete indefinidamente: cria só o lançamento atual.
      if (mode === "recorrente") {
        const { error } = await supabase.from("entries").insert({
          ...base,
          user_id: userId,
          series_id: crypto.randomUUID(),
          is_recurring: true,
          recurrence_interval_months: Math.max(1, recurrence?.intervalMonths ?? 1),
          recurrence_unit: recurrence?.unit ?? "mes",
          installment_no: null,
          installment_total: null,
        });
        if (error) throw error;
        return;
      }

      // Parcelamento: todas as parcelas com o mesmo valor.
      const total =
        mode === "parcelada" ? Math.max(1, Math.min(recurrence?.count ?? 1, 120)) : 1;
      const seriesId = total > 1 ? crypto.randomUUID() : null;

      const rows = Array.from({ length: total }, (_, i) => ({
        ...base,
        user_id: userId,
        series_id: seriesId,
        is_recurring: false,
        recurrence_interval_months: 1,
        recurrence_unit: "mes" as const,
        installment_no: total > 1 ? i + 1 : null,
        installment_total: total > 1 ? total : null,
        due_date: i === 0 ? base.due_date : nextDate(base.due_date, recurrence!, i),
        status: i === 0 ? base.status : ("pendente" as EntryStatus),
        paid_at: i === 0 ? base.paid_at : null,
      }));

      const { error } = await supabase.from("entries").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries"] }),
  });
}

/**
 * Soma um valor a uma conta avulsa. Se o lançamento da série for de um mês
 * anterior, cria um novo lançamento do mês corrente começando do zero.
 */
export function useAddToAvulsa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ entry, valor }: { entry: Entry; valor: number }) => {
      const ref = currentMonthRef();
      const seriesId = entry.series_id ?? entry.id;

      if (entry.month_ref === ref) {
        const { error } = await supabase
          .from("entries")
          .update({ amount: Number(entry.amount) + valor })
          .eq("id", entry.id);
        if (error) throw error;
        return { novoMes: false };
      }

      const { data: atual } = await supabase
        .from("entries")
        .select("id, amount")
        .eq("series_id", seriesId)
        .eq("month_ref", ref)
        .maybeSingle();

      if (atual) {
        const { error } = await supabase
          .from("entries")
          .update({ amount: Number(atual.amount) + valor })
          .eq("id", atual.id);
        if (error) throw error;
        return { novoMes: false };
      }

      const { error } = await supabase.from("entries").insert({
        user_id: entry.user_id,
        description: entry.description,
        amount: valor,
        due_date: lastDayOfMonth(todayISO()),
        category_id: entry.category_id,
        kind: entry.kind,
        status: "pendente",
        paid_at: null,
        notes: entry.notes,
        attachment_path: null,
        barcode: null,
        series_id: seriesId,
        is_recurring: false,
        is_avulsa: true,
        month_ref: ref,
        recurrence_interval_months: 1,
        recurrence_unit: "mes",
      });
      if (error) throw error;
      return { novoMes: true };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries"] }),
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries"] }),
  });
}

export function useTogglePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      entry,
      paidAt,
      nextDueDate,
    }: {
      entry: Entry;
      paidAt: string | null;
      nextDueDate?: string | null;
    }) => {
      const { error } = await supabase
        .from("entries")
        .update({
          status: paidAt ? "pago" : "pendente",
          paid_at: paidAt,
        })
        .eq("id", entry.id);
      if (error) throw error;

      // Conta recorrente paga → gera o próximo período com valor zerado.
      if (!paidAt || !entry.is_recurring) return false;

      const passo = Math.max(1, entry.recurrence_interval_months || 1);
      const proximoVenc =
        nextDueDate ||
        (entry.recurrence_unit === "semana"
          ? addDays(entry.due_date, passo * 7)
          : addMonths(entry.due_date, passo));


      const { data: existente } = await supabase
        .from("entries")
        .select("id")
        .eq("series_id", entry.series_id ?? "")
        .eq("due_date", proximoVenc)
        .maybeSingle();
      if (existente) return false;

      const { error: insertError } = await supabase.from("entries").insert({
        user_id: entry.user_id,
        description: entry.description,
        amount: 0,
        due_date: proximoVenc,
        category_id: entry.category_id,
        kind: entry.kind,
        status: "pendente",
        paid_at: null,
        notes: entry.notes,
        attachment_path: null,
        barcode: null,
        series_id: entry.series_id,
        is_recurring: true,
        recurrence_interval_months: entry.recurrence_interval_months,
        recurrence_unit: entry.recurrence_unit,
      });
      if (insertError) throw insertError;
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entries"] }),
  });
}


export type CategoryInput = {
  name: string;
  kind: EntryKind;
  color: string;
  icon: string;
  recurrence_mode?: Category["recurrence_mode"];
  recurrence_interval?: number;
  recurrence_count?: number | null;
};

export function useSaveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id?: string;
      values: CategoryInput;
    }) => {
      if (id) {
        const { error } = await supabase.from("categories").update(values).eq("id", id);
        if (error) throw error;
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada");
      const { error } = await supabase.from("categories").insert({ ...values, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}
