import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Diz se as credenciais da Z-API estão completas (sem expor nenhum valor). */
export const statusWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { verificarZapi } = await import("@/lib/avisos.server");
    return verificarZapi();
  });

/** Testa as credenciais direto na Z-API (sem enviar mensagem) e detalha o erro. */
export const validarWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { testarConexaoZapi } = await import("@/lib/avisos.server");
    return testarConexaoZapi();
  });


/** Envia uma mensagem de teste pelo WhatsApp (Z-API) para o número cadastrado. */
export const testarWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { numero?: string } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    const { carregarPerfil, enviarWhatsappZapi, verificarZapi } = await import(
      "@/lib/avisos.server"
    );
    const { normalizarWhatsapp } = await import("@/lib/phone");
    const zapi = verificarZapi();
    if (!zapi.pronto) return { enviado: false, status: "sem_zapi", detalhe: zapi.mensagem };

    const perfil = await carregarPerfil(context.userId, context.supabase);
    if (!perfil) throw new Error("Perfil não encontrado");
    const bruto = (data.numero ?? "").trim() || perfil.whatsapp || "";
    const fone = normalizarWhatsapp(bruto);
    if (!fone.valido) throw new Error(fone.motivo ?? "Número de WhatsApp inválido");

    const texto =
      "✅ Agenda de Contas: teste de WhatsApp realizado com sucesso. Os avisos de vencimento serão enviados por aqui.";
    const r = await enviarWhatsappZapi(
      { ...perfil, whatsapp: fone.e164 },
      { assunto: "Teste de WhatsApp", texto, html: texto, vazio: false },
    );
    return { enviado: r.enviado, status: r.status, detalhe: r.detalhe, numero: fone.formatado };
  });


/** Envia agora o resumo de avisos (e-mail e/ou WhatsApp) configurados (teste manual). */

export const enviarAvisoTeste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { carregarPerfil, enviarResumo } = await import("@/lib/avisos.server");
    const perfil = await carregarPerfil(context.userId, context.supabase);
    if (!perfil) throw new Error("Perfil não encontrado");
    if (!perfil.notify_email && !(perfil.notify_whatsapp && perfil.whatsapp))
      throw new Error("Cadastre um e-mail ou ative o WhatsApp antes de testar");

    const r = await enviarResumo(perfil, { tipo: "teste", ignorarVazio: true }, context.supabase);
    return {
      enviado: r.enviado,
      status: r.status,
      detalhe: r.detalhe,
      assunto: r.resumo.assunto,
      previa: r.resumo.texto,
      whatsapp: r.whatsapp ?? null,
    };
  });

/** Prévia do resumo do dia, sem enviar nada. */
export const previaAviso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { carregarPerfil, montarResumo } = await import("@/lib/avisos.server");
    const perfil = await carregarPerfil(context.userId, context.supabase);
    if (!perfil) throw new Error("Perfil não encontrado");
    const resumo = await montarResumo(perfil, context.supabase);
    return { assunto: resumo.assunto, texto: resumo.texto, vazio: resumo.vazio };
  });

/** Últimos avisos registrados (histórico de envio). */
export const historicoAvisos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notification_log")
      .select("id, kind, ref_date, channel, status, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw error;
    return data ?? [];
  });

/** Logs completos de envio (e-mail e WhatsApp) para a tela de auditoria. */
export const logsAvisos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [logs, perfil] = await Promise.all([
      context.supabase
        .from("notification_log")
        .select("id, kind, ref_date, channel, status, detail, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      context.supabase
        .from("profiles")
        .select("notify_email, whatsapp")
        .eq("id", context.userId)
        .maybeSingle(),
    ]);
    if (logs.error) throw logs.error;
    return {
      destinos: {
        email: perfil.data?.notify_email ?? null,
        whatsapp: perfil.data?.whatsapp ?? null,
      },
      itens: logs.data ?? [],
    };
  });

/** Limpa o histórico de avisos: só as falhas ou tudo. */
export const limparLogsAvisos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { escopo?: "falhas" | "todos" } | undefined) => ({
    escopo: input?.escopo === "todos" ? ("todos" as const) : ("falhas" as const),
  }))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("notification_log")
      .delete()
      .eq("user_id", context.userId);
    if (data.escopo === "falhas") {
      q = q.not("status", "in", "(enviado,ok,sucesso)");
    }
    const { error } = await q;
    if (error) throw error;
    return { ok: true, escopo: data.escopo };
  });

/** Diz se a conta do Gmail está conectada/configurada (sem expor credenciais). */
export const statusGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { carregarPerfil, verificarGmail } = await import("@/lib/avisos.server");
    const perfil = await carregarPerfil(context.userId, context.supabase);
    return verificarGmail(perfil?.smtp_config ?? null);
  });

/**
 * Testa o login no Gmail: usa os dados digitados e, no que faltar, o que já está
 * salvo em profiles.smtp_config. Envia também uma mensagem de teste.
 */
export const testarConexaoGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user?: string; pass?: string } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    const { carregarPerfil, testarConexaoSmtp } = await import("@/lib/avisos.server");
    const perfil = await carregarPerfil(context.userId, context.supabase);
    const salvo = perfil?.smtp_config ?? null;
    const user = data.user?.trim() || salvo?.user?.trim() || "";
    const pass = data.pass?.replace(/\s+/g, "") || salvo?.pass || "";
    return testarConexaoSmtp(
      {
        mode: "app",
        host: salvo?.host ?? "smtp.gmail.com",
        port: salvo?.port ?? 465,
        secure: salvo?.secure ?? true,
        user,
        pass,
      },
      perfil?.notify_email ?? null,
    );
  });
