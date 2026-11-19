import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, addMonths } from "@/lib/dates";

export type HealthKind = "consulta" | "exame" | "remedio" | "terapia";
export type TherapyType = "acupuntura" | "fisioterapia";
export type TherapyFrequency = "diaria" | "semanal";
export type PlaceType = "clinica" | "hospital" | "farmacia" | "posto" | "laboratorio" | "outro";

export type HealthEvent = {
  id: string;
  user_id: string;
  kind: HealthKind;
  title: string;
  scheduled_date: string;
  scheduled_time: string | null;
  place_type: PlaceType;
  place_name: string | null;
  phone: string | null;
  cep: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  done: boolean;
  is_recurring: boolean;
  recurrence_interval_months: number;
  series_id: string | null;
  therapy_type: TherapyType | null;
  session_frequency: TherapyFrequency | null;
  session_number: number | null;
  session_total: number | null;
};

export const HEALTH_KIND_LABEL: Record<HealthKind, string> = {
  consulta: "Consulta",
  exame: "Exame",
  remedio: "Retirada de remédio",
  terapia: "Terapia",
};

export const THERAPY_TYPE_LABEL: Record<TherapyType, string> = {
  acupuntura: "Acupuntura",
  fisioterapia: "Fisioterapia",
};

export const THERAPY_FREQUENCY_LABEL: Record<TherapyFrequency, string> = {
  diaria: "Diária",
  semanal: "Semanal",
};

export const PLACE_LABEL: Record<PlaceType, string> = {
  clinica: "Clínica",
  hospital: "Hospital",
  laboratorio: "Laboratório",
  farmacia: "Farmácia",
  posto: "Posto de saúde",
  outro: "Outro",
};

export function formatHealthAddress(e: HealthEvent): string {
  const linha = [e.street, e.number].filter(Boolean).join(", ");
  const resto = [e.complement, e.district, [e.city, e.state].filter(Boolean).join(" - ")]
    .filter(Boolean)
    .join(" · ");
  return [linha, resto].filter(Boolean).join(" · ");
}

export type Endereco = {
  cep: string;
  street: string;
  district: string;
  city: string;
  state: string;
};

/** Busca endereço pelo CEP (ViaCEP). */
export async function buscarCep(cepBruto: string): Promise<Endereco> {
  const cep = cepBruto.replace(/\D/g, "");
  if (cep.length !== 8) throw new Error("CEP deve ter 8 dígitos");
  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!res.ok) throw new Error("Não foi possível consultar o CEP");
  const data = (await res.json()) as Record<string, string> & { erro?: boolean | string };
  if (data.erro) throw new Error("CEP não encontrado");
  return {
    cep,
    street: data.logradouro ?? "",
    district: data.bairro ?? "",
    city: data.localidade ?? "",
    state: data.uf ?? "",
  };
}

export async function buscarCepPorEndereco(
  uf: string,
  cidade: string,
  logradouro: string,
): Promise<Endereco[]> {
  const estado = uf.trim().toUpperCase();
  const city = cidade.trim();
  const rua = logradouro.trim();
  if (estado.length !== 2) throw new Error("Informe a UF (2 letras)");
  if (city.length < 3) throw new Error("Informe a cidade");
  if (rua.length < 3) throw new Error("Informe o logradouro (mínimo 3 letras)");
  const url = `https://viacep.com.br/ws/${estado}/${encodeURIComponent(city)}/${encodeURIComponent(rua)}/json/`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Não foi possível consultar o endereço");
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data) || data.length === 0) throw new Error("Nenhum CEP encontrado para esse endereço");
  return (data as Record<string, string>[]).map((d) => ({
    cep: (d.cep ?? "").replace(/\D/g, ""),
    street: d.logradouro ?? "",
    district: d.bairro ?? "",
    city: d.localidade ?? "",
    state: d.uf ?? "",
  }));
}

async function idDoUsuario(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Sua sessão expirou. Entre novamente para carregar seus agendamentos.");
  }
  return data.user.id;
}

export function useHealthEvents() {
  return useQuery({
    queryKey: ["health_events"],
    queryFn: async (): Promise<HealthEvent[]> => {
      const userId = await idDoUsuario();
      const { data, error } = await supabase
        .from("health_events")
        .select("*")
        .eq("user_id", userId)
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return (data ?? []) as HealthEvent[];
    },
  });
}

export type HealthInput = Omit<HealthEvent, "id" | "user_id">;

export const therapySessionDates = (
  startDate: string,
  total: number,
  frequency: TherapyFrequency,
  skippedWeekdays: number[],
) => {
  const dates = [startDate];
  const skipped = new Set(skippedWeekdays);
  while (dates.length < total) {
    let nextDate = addDays(
      dates[dates.length - 1]!,
      frequency === "semanal" ? 7 : 1,
    );
    while (skipped.has(new Date(`${nextDate}T12:00:00`).getDay())) {
      nextDate = addDays(nextDate, 1);
    }
    dates.push(nextDate);
  }
  return dates;
};

export function useSaveHealthEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, event, values, skippedWeekdays = [0, 6] }: { id?: string; event?: HealthEvent | null; values: HealthInput; skippedWeekdays?: number[] }) => {
      const sessionTotal = values.kind === "terapia" ? values.session_total ?? 10 : 1;
      const dates = values.kind === "terapia"
        ? therapySessionDates(values.scheduled_date, sessionTotal, values.session_frequency ?? "diaria", skippedWeekdays)
        : [values.scheduled_date];

      if (id) {
        const convertingToTherapy = event?.kind !== "terapia" && values.kind === "terapia";
        const seriesId = convertingToTherapy ? crypto.randomUUID() : values.series_id;
        const firstSession = {
          ...values,
          series_id: seriesId ?? null,
          session_number: values.kind === "terapia" ? 1 : values.session_number,
          session_total: values.kind === "terapia" ? sessionTotal : values.session_total,
          scheduled_date: dates[0]!,
        };
        const { error } = await supabase.from("health_events").update(firstSession).eq("id", id);
        if (error) throw error;
        if (convertingToTherapy && dates.length > 1) {
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData.user?.id;
          if (!userId) throw new Error("Sessão expirada");
          const { error: insertError } = await supabase.from("health_events").insert(
            dates.slice(1).map((scheduled_date, index) => ({
              ...firstSession,
              user_id: userId,
              done: false,
              scheduled_date,
              session_number: index + 2,
            })),
          );
          if (insertError) throw insertError;
        }
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada");
      const seriesId = values.kind === "terapia" ? crypto.randomUUID() : values.series_id;
      const sessions = dates.map((scheduled_date, index) => ({
        ...values,
        user_id: userId,
        series_id: seriesId,
        session_number: values.kind === "terapia" ? index + 1 : null,
        session_total: values.kind === "terapia" ? sessionTotal : null,
        scheduled_date,
      }));
      const { error } = await supabase.from("health_events").insert(sessions);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["health_events"] }),
  });
}

export function useToggleHealthDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ event, done }: { event: HealthEvent; done: boolean }) => {
      const seriesId = event.series_id ?? crypto.randomUUID();
      const { error } = await supabase
        .from("health_events")
        .update({ done, series_id: seriesId })
        .eq("id", event.id);
      if (error) throw error;

      if (!done || !event.is_recurring) return false;

      const proximaData = addMonths(event.scheduled_date, Math.max(1, event.recurrence_interval_months || 1));
      const { data: existente } = await supabase
        .from("health_events")
        .select("id")
        .eq("series_id", seriesId)
        .eq("scheduled_date", proximaData)
        .maybeSingle();
      if (existente) return false;

      const { error: insertError } = await supabase.from("health_events").insert({
        user_id: event.user_id,
        kind: event.kind,
        title: event.title,
        scheduled_date: proximaData,
        scheduled_time: event.scheduled_time,
        place_type: event.place_type,
        place_name: event.place_name,
        phone: event.phone,
        cep: event.cep,
        street: event.street,
        number: event.number,
        complement: event.complement,
        district: event.district,
        city: event.city,
        state: event.state,
        notes: event.notes,
        done: false,
        is_recurring: true,
        recurrence_interval_months: event.recurrence_interval_months,
        series_id: seriesId,
        therapy_type: event.therapy_type,
        session_frequency: event.session_frequency,
        session_number: event.session_number,
        session_total: event.session_total,
      });
      if (insertError) throw insertError;
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["health_events"] }),
  });
}

export function useDeleteHealthEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("health_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["health_events"] }),
  });
}
