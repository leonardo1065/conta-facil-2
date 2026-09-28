import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizarWhatsapp } from "@/lib/phone";


export type Settings = {
  display_name: string | null;
  notify_email: string | null;
  notify_email_secondary: string | null;
  whatsapp: string | null;
  notify_days_before: number;
  notify_enabled: boolean;
  notify_health: boolean;
  notify_hour: number;
  notify_on_due_date: boolean;
  health_days_before: number;
  notify_whatsapp: boolean;
  health_notify_email: string | null;
  health_notify_whatsapp: string | null;
  health_via_email: boolean;
  health_via_whatsapp: boolean;
  email_subject_tpl: string | null;
  email_body_tpl: string | null;
  smtp_config?: SmtpConfig | null;
};

/** Credenciais de envio do Gmail guardadas em profiles.smtp_config. */
export type SmtpConfig = {
  /** "app" = senha de app do Gmail; "oauth" = autorização pelo Google (conector). */
  mode?: "app" | "oauth";
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
};

const COLS =
  "display_name, notify_email, notify_email_secondary, whatsapp, notify_days_before, notify_enabled, notify_health, notify_hour, notify_on_due_date, health_days_before, notify_whatsapp, health_notify_email, health_notify_whatsapp, health_via_email, health_via_whatsapp, email_subject_tpl, email_body_tpl, smtp_config";


export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<Settings | null> => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select(COLS)
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Settings | null;
    },
  });
}


export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<Settings>) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada");
      const { error } = await supabase.from("profiles").update(values).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

/** Link de conversa no WhatsApp com resumo das contas a vencer. */
export function whatsappLink(numero: string, mensagem: string): string {
  const r = normalizarWhatsapp(numero);
  const destino = r.valido ? r.digitos : numero.replace(/\D/g, "");
  return `https://wa.me/${destino}?text=${encodeURIComponent(mensagem)}`;
}

