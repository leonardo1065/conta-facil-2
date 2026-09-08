import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addMonths } from "@/lib/dates";

export type HealthKind = "consulta" | "exame" | "remedio";
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
};

export const HEALTH_KIND_LABEL: Record<HealthKind, string> = {
  consulta: "Consulta",
  exame: "Exame",
  remedio: "Retirada de remédio",
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

export function useHealthEvents() {
  return useQuery({
    queryKey: ["health_events"],
    queryFn: async (): Promise<HealthEvent[]> => {
      const { data, error } = await supabase
        .from("health_events")
        .select("*")
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return (data ?? []) as HealthEvent[];
    },
  });
}

export type HealthInput = Omit<HealthEvent, "id" | "user_id">;

export function useSaveHealthEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: HealthInput }) => {
      if (id) {
        const { error } = await supabase.from("health_events").update(values).eq("id", id);
        if (error) throw error;
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada");
      const { error } = await supabase.from("health_events").insert({ ...values, user_id: userId });
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
