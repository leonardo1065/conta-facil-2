// Montagem e envio dos avisos automáticos (contas a vencer + saúde).
// Server-only: usa service role para varrer todos os usuários no cron.
import { sendLovableEmail, EmailAPIError } from "@lovable.dev/email-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { addDays, diffDays, formatBRL, formatDate, todayISO } from "./dates";
import { normalizarWhatsapp } from "./phone";
import { renderizarTemplate, type TemplateContexto } from "./email-template";


export type AvisoPerfil = {
  id: string;
  display_name: string | null;
  notify_email: string | null;
  whatsapp: string | null;
  notify_days_before: number;
  notify_enabled: boolean;
  notify_health: boolean;
  notify_hour: number;
  health_days_before: number;
  notify_whatsapp: boolean;
  email_subject_tpl: string | null;
  email_body_tpl: string | null;
};

export type AvisoResumo = {
  assunto: string;
  texto: string;
  html: string;
  vazio: boolean;
};

const PERFIL_COLS =
  "id, display_name, notify_email, whatsapp, notify_days_before, notify_enabled, notify_health, notify_hour, health_days_before, notify_whatsapp, email_subject_tpl, email_body_tpl";

/** Hora atual (0-23) no fuso America/Sao_Paulo. */
export function horaSaoPaulo(): number {
  const h = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hour12: false,
  }).format(new Date());
  return Number(h);
}

export async function carregarPerfil(userId: string): Promise<AvisoPerfil | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(PERFIL_COLS)
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as AvisoPerfil | null;
}

/** Perfis que pediram aviso para a hora informada e têm e-mail ou WhatsApp cadastrado. */
export async function perfisParaHora(hora: number): Promise<AvisoPerfil[]> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(PERFIL_COLS)
    .eq("notify_enabled", true)
    .eq("notify_hour", hora);
  if (error) throw error;
  return ((data ?? []) as AvisoPerfil[]).filter(
    (p) => p.notify_email || (p.notify_whatsapp && p.whatsapp),
  );
}

/**
 * Perfis cujo horário já passou hoje — candidatos a reenvio automático.
 * O hook só tenta de novo quem ainda não teve envio bem-sucedido no dia.
 */
export async function perfisParaReenvio(hora: number): Promise<AvisoPerfil[]> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(PERFIL_COLS)
    .eq("notify_enabled", true)
    .lt("notify_hour", hora);
  if (error) throw error;
  return ((data ?? []) as AvisoPerfil[]).filter(
    (p) => p.notify_email || (p.notify_whatsapp && p.whatsapp),
  );
}


type ContaAviso = {
  description: string;
  amount: number;
  due_date: string;
};

type SaudeAviso = {
  title: string;
  kind: string;
  scheduled_date: string;
  scheduled_time: string | null;
  place_name: string | null;
};

/** Monta o resumo do dia para um perfil: contas a vencer e compromissos de saúde. */
export async function montarResumo(perfil: AvisoPerfil): Promise<AvisoResumo> {
  const hoje = todayISO();
  const limiteContas = addDays(hoje, Math.max(0, perfil.notify_days_before ?? 3));

  const { data: contasRaw, error: erroContas } = await supabaseAdmin
    .from("entries")
    .select("description, amount, due_date")
    .eq("user_id", perfil.id)
    .eq("kind", "despesa")
    .eq("status", "pendente")
    .lte("due_date", limiteContas)
    .order("due_date", { ascending: true });
  if (erroContas) throw erroContas;
  const contas = (contasRaw ?? []) as ContaAviso[];

  let saude: SaudeAviso[] = [];
  if (perfil.notify_health) {
    const limiteSaude = addDays(hoje, Math.max(0, perfil.health_days_before ?? 1));
    const { data, error } = await supabaseAdmin
      .from("health_events")
      .select("title, kind, scheduled_date, scheduled_time, place_name")
      .eq("user_id", perfil.id)
      .eq("done", false)
      .gte("scheduled_date", hoje)
      .lte("scheduled_date", limiteSaude)
      .order("scheduled_date", { ascending: true });
    if (error) throw error;
    saude = (data ?? []) as SaudeAviso[];
  }

  const vencidas = contas.filter((c) => diffDays(hoje, c.due_date) < 0);
  const doDia = contas.filter((c) => diffDays(hoje, c.due_date) === 0);
  const futuras = contas.filter((c) => diffDays(hoje, c.due_date) > 0);
  const total = contas.reduce((s, c) => s + Number(c.amount ?? 0), 0);

  const linhaConta = (c: ContaAviso) =>
    `${c.description} — ${formatBRL(Number(c.amount ?? 0))} — vence ${formatDate(c.due_date)}`;
  const linhaSaude = (s: SaudeAviso) =>
    `${s.title} (${s.kind}) — ${formatDate(s.scheduled_date)}${
      s.scheduled_time ? ` às ${s.scheduled_time.slice(0, 5)}` : ""
    }${s.place_name ? ` — ${s.place_name}` : ""}`;

  const blocos: { titulo: string; itens: string[] }[] = [];
  if (vencidas.length) blocos.push({ titulo: "Vencidas", itens: vencidas.map(linhaConta) });
  if (doDia.length) blocos.push({ titulo: "Vencem hoje", itens: doDia.map(linhaConta) });
  if (futuras.length) blocos.push({ titulo: "A vencer", itens: futuras.map(linhaConta) });
  if (saude.length) blocos.push({ titulo: "Saúde", itens: saude.map(linhaSaude) });

  const vazio = blocos.length === 0;
  const assunto = vazio
    ? "Agenda de Contas — nada pendente hoje"
    : `Agenda de Contas — ${contas.length} conta(s) e ${saude.length} compromisso(s)`;

  const saudacao = perfil.display_name ? `Olá, ${perfil.display_name}!` : "Olá!";
  const texto = vazio
    ? `${saudacao}\n\nNenhuma conta a vencer e nenhum compromisso de saúde no período configurado.`
    : [
        saudacao,
        "",
        ...blocos.flatMap((b) => [`${b.titulo}:`, ...b.itens.map((i) => `• ${i}`), ""]),
        `Total das contas listadas: ${formatBRL(total)}`,
      ].join("\n");

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#0f172a">
  <h2 style="margin:0 0 12px">Agenda de Contas</h2>
  <p style="margin:0 0 16px">${saudacao}</p>
  ${
    vazio
      ? "<p>Nenhuma conta a vencer e nenhum compromisso de saúde no período configurado.</p>"
      : blocos
          .map(
            (b) =>
              `<h3 style="margin:16px 0 6px;font-size:15px">${b.titulo}</h3><ul style="margin:0;padding-left:18px">${b.itens
                .map((i) => `<li style="margin:2px 0">${i}</li>`)
                .join("")}</ul>`,
          )
          .join("") +
        `<p style="margin-top:16px"><strong>Total das contas listadas: ${formatBRL(total)}</strong></p>`
  }
</div>`;

  if (!vazio && temTemplate(perfil)) {
    const ctx = contextoTemplate(perfil, {
      titulo: "Resumo do dia",
      data: formatDate(hoje),
      itens: blocos.flatMap((b) => [`${b.titulo}:`, ...b.itens]),
      quantidade: contas.length,
      total,
    });
    const r = renderizarTemplate(perfil.email_subject_tpl, perfil.email_body_tpl, ctx);
    return { ...r, vazio };
  }

  return { assunto, texto, html, vazio };
}

/** O usuário personalizou o modelo do e-mail? */
export function temTemplate(perfil: AvisoPerfil): boolean {
  return Boolean(perfil.email_subject_tpl?.trim() || perfil.email_body_tpl?.trim());
}

/** Monta o contexto de tags do modelo a partir dos dados do aviso. */
export function contextoTemplate(
  perfil: AvisoPerfil,
  dados: { titulo: string; data: string; itens: string[]; quantidade: number; total: number },
): TemplateContexto {
  const nome = perfil.display_name?.trim() ?? "";
  return {
    nome,
    saudacao: nome ? `Olá, ${nome}!` : "Olá!",
    titulo: dados.titulo,
    data: dados.data,
    quantidade: String(dados.quantidade),
    total: formatBRL(dados.total),
    itens: dados.itens,
  };
}


/**
 * Resumo específico de vencimento: contas pendentes que vencem exatamente
 * amanhã (véspera), hoje (no dia) ou que já estão vencidas (atrasadas).
 */
export async function montarResumoVencimento(
  perfil: AvisoPerfil,
  quando: "amanha" | "hoje" | "vencidas",
): Promise<AvisoResumo> {
  const hoje = todayISO();
  const alvo = quando === "hoje" ? hoje : quando === "amanha" ? addDays(hoje, 1) : hoje;

  const base = supabaseAdmin
    .from("entries")
    .select("description, amount, due_date")
    .eq("user_id", perfil.id)
    .eq("kind", "despesa")
    .eq("status", "pendente");

  const { data, error } =
    quando === "vencidas"
      ? await base.lt("due_date", hoje).order("due_date", { ascending: true })
      : await base.eq("due_date", alvo).order("amount", { ascending: false });
  if (error) throw error;

  const contas = (data ?? []) as ContaAviso[];
  const total = contas.reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const vazio = contas.length === 0;
  const titulo =
    quando === "hoje"
      ? `Vence hoje (${formatDate(alvo)})`
      : quando === "amanha"
        ? `Vence amanhã (${formatDate(alvo)})`
        : "Contas vencidas (em atraso)";
  const assunto = vazio
    ? `Agenda de Contas — nenhuma conta ${
        quando === "hoje" ? "vencendo hoje" : quando === "amanha" ? "vencendo amanhã" : "em atraso"
      }`
    : quando === "vencidas"
      ? `🔴 Vencidas: ${contas.length} conta(s) em atraso — ${formatBRL(total)}`
      : `${quando === "hoje" ? "⚠️ Vence hoje" : "⏰ Vence amanhã"}: ${contas.length} conta(s) — ${formatBRL(total)}`;

  const saudacao = perfil.display_name ? `Olá, ${perfil.display_name}!` : "Olá!";
  const linhas = contas.map(
    (c) =>
      `${c.description} — ${formatBRL(Number(c.amount ?? 0))} — ${
        quando === "vencidas" ? "venceu" : "vence"
      } ${formatDate(c.due_date)}`,
  );
  const vazioTexto =
    quando === "vencidas"
      ? "Nenhuma conta em atraso. Tudo em dia!"
      : `Nenhuma conta com vencimento em ${formatDate(alvo)}.`;
  const texto = vazio
    ? `${saudacao}\n\n${vazioTexto}`
    : [saudacao, "", `${titulo}:`, ...linhas.map((l) => `• ${l}`), "", `Total: ${formatBRL(total)}`].join(
        "\n",
      );

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#0f172a">
  <h2 style="margin:0 0 12px">${titulo}</h2>
  <p style="margin:0 0 16px">${saudacao}</p>
  ${
    vazio
      ? `<p>${vazioTexto}</p>`
      : `<ul style="margin:0;padding-left:18px">${linhas
          .map((l) => `<li style="margin:2px 0">${l}</li>`)
          .join("")}</ul><p style="margin-top:16px"><strong>Total: ${formatBRL(total)}</strong></p>`
  }
</div>`;

  if (!vazio && temTemplate(perfil)) {
    const ctx = contextoTemplate(perfil, {
      titulo,
      data: formatDate(alvo),
      itens: linhas,
      quantidade: contas.length,
      total,
    });
    const r = renderizarTemplate(perfil.email_subject_tpl, perfil.email_body_tpl, ctx);
    return { ...r, vazio };
  }

  return { assunto, texto, html, vazio };
}



function remetente(): string {
  const email = process.env.AVISOS_FROM_EMAIL;
  const domain = process.env.AVISOS_SENDER_DOMAIN;
  if (email) return `Agenda de Contas <${email}>`;
  if (domain) return `Agenda de Contas <avisos@${domain}>`;
  return "Agenda de Contas <avisos@lovable.app>";
}

/** Número em E.164 (assume Brasil quando vier sem código do país). */
export function telefoneE164(numero: string): string {
  const r = normalizarWhatsapp(numero);
  if (r.valido) return r.e164;
  const so = numero.replace(/\D/g, "");
  return `+${so.startsWith("55") ? so : `55${so}`}`;
}


export type ResultadoCanal = {
  enviado: boolean;
  status: string;
  detalhe: string;
  tentativas?: number;
  /** true quando não vale tentar de novo (falta de configuração, número inválido etc.). */
  definitivo?: boolean;
};

/** Falhas que não se resolvem com nova tentativa. */
const STATUS_DEFINITIVOS = ["sem_whatsapp", "sem_twilio", "sem_zapi", "sem_email", "sem_config"];

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Reenvia automaticamente em caso de falha (até 3 tentativas, com espera
 * progressiva). Retorna o último resultado, com o total de tentativas e o motivo.
 */
export async function comRepeticao(
  canal: string,
  envio: () => Promise<ResultadoCanal>,
  tentativasMax = 3,
): Promise<ResultadoCanal> {
  let ultimo: ResultadoCanal = { enviado: false, status: "falha", detalhe: "não executado" };
  for (let tentativa = 1; tentativa <= tentativasMax; tentativa++) {
    ultimo = await envio();
    ultimo.tentativas = tentativa;
    if (ultimo.enviado) return ultimo;
    if (ultimo.definitivo || STATUS_DEFINITIVOS.includes(ultimo.status)) {
      ultimo.definitivo = true;
      return ultimo;
    }
    console.error(
      `[avisos] ${canal} falhou (tentativa ${tentativa}/${tentativasMax}): ${ultimo.status} — ${ultimo.detalhe}`,
    );
    if (tentativa < tentativasMax) await espera(tentativa * 1500);
  }
  ultimo.detalhe = `${ultimo.detalhe} (após ${tentativasMax} tentativas)`.slice(0, 500);
  return ultimo;
}

/** Somente dígitos, com DDI 55 garantido (formato exigido pela Z-API). */
function telefoneZapi(numero: string): string {
  return normalizarWhatsapp(numero).digitos;
}


/** Nome amigável de cada credencial da Z-API (usado nas mensagens de erro). */
const ZAPI_VARS = {
  ZAPI_INSTANCE_ID: "ID da instância",
  ZAPI_INSTANCE_TOKEN: "Token da instância",
  ZAPI_CLIENT_TOKEN: "Client-Token (aba Segurança)",
} as const;

type ChaveZapi = keyof typeof ZAPI_VARS;

export type ItemZapi = {
  chave: ChaveZapi;
  rotulo: string;
  ok: boolean;
  /** Motivo exato da invalidez ("" quando ok). Nunca contém o valor do segredo. */
  problema: string;
};

export type StatusZapi = {
  /** true quando as três credenciais estão preenchidas e com formato plausível. */
  pronto: boolean;
  /** Quais credenciais estão presentes (nunca expõe os valores). */
  presentes: Record<ChaveZapi, boolean>;
  /** Nomes das credenciais que faltam ou estão inválidas. */
  faltando: string[];
  /** Diagnóstico item a item, para exibir na tela de configurações. */
  itens: ItemZapi[];
  /** Mensagem pronta para exibir ao usuário ("" quando tudo certo). */
  mensagem: string;
};

const PLACEHOLDERS = [
  "seu_token",
  "seutoken",
  "changeme",
  "xxxxxxxx",
  "coloque",
  "todo",
  "exemplo",
  "example",
  "placeholder",
  "your_",
  "<",
];

/** Valida uma credencial isolada e devolve o motivo exato do erro. */
function validarCredencial(chave: ChaveZapi, bruto: string | undefined): string {
  if (bruto === undefined || bruto === "") return "não configurado nos segredos do projeto";
  if (bruto.trim() === "") return "está em branco (só espaços)";
  if (bruto !== bruto.trim()) return "tem espaços no início/fim — salve o valor sem espaços";
  const valor = bruto.trim();
  if (/\s/.test(valor)) return "contém espaços no meio — copie o valor completo, sem quebras";
  if (/^["'].*["']$/.test(valor)) return "está entre aspas — salve o valor sem aspas";
  const minusculo = valor.toLowerCase();
  if (PLACEHOLDERS.some((p) => minusculo.includes(p)))
    return "parece um valor de exemplo, não a credencial real";
  if (valor.length < 8) return `muito curto (${valor.length} caracteres; o mínimo é 8)`;
  if (!/^[A-Za-z0-9._-]+$/.test(valor))
    return "tem caracteres inválidos — use apenas letras, números, ponto, hífen ou underline";
  if (chave === "ZAPI_INSTANCE_ID" && valor.length < 12)
    return "curto demais para um ID de instância da Z-API (esperado ~32 caracteres)";
  if (chave === "ZAPI_INSTANCE_TOKEN" && valor.length < 12)
    return "curto demais para um token de instância da Z-API (esperado ~32 caracteres)";
  if (valor.length > 200) return "longo demais — verifique se não colou o valor duplicado";
  return "";
}

/** Valida as credenciais da Z-API sem revelar nenhum valor. */
export function verificarZapi(): StatusZapi {
  const presentes = {} as Record<ChaveZapi, boolean>;
  const faltando: string[] = [];
  const itens: ItemZapi[] = [];
  for (const chave of Object.keys(ZAPI_VARS) as ChaveZapi[]) {
    const problema = validarCredencial(chave, process.env[chave]);
    const ok = problema === "";
    presentes[chave] = ok;
    itens.push({ chave, rotulo: ZAPI_VARS[chave], ok, problema });
    if (!ok) faltando.push(`${chave} (${ZAPI_VARS[chave]})`);
  }
  const invalidos = itens.filter((i) => !i.ok);
  return {
    pronto: invalidos.length === 0,
    presentes,
    faltando,
    itens,
    mensagem: invalidos.length
      ? `WhatsApp desativado: ${invalidos.map((i) => `${i.chave} ${i.problema}`).join("; ")}.`
      : "",
  };
}

/** Testa as credenciais direto na Z-API (endpoint /status), sem enviar mensagem. */
export async function testarConexaoZapi(): Promise<{
  ok: boolean;
  detalhe: string;
  conectado?: boolean;
}> {
  const status = verificarZapi();
  if (!status.pronto) return { ok: false, detalhe: status.mensagem };

  const instancia = process.env.ZAPI_INSTANCE_ID!.trim();
  const token = process.env.ZAPI_INSTANCE_TOKEN!.trim();
  const clientToken = process.env.ZAPI_CLIENT_TOKEN!.trim();
  const url = `https://api.z-api.io/instances/${instancia}/token/${token}/status`;

  try {
    const resposta = await fetch(url, { headers: { "Client-Token": clientToken } });
    const corpo = (await resposta.text()).slice(0, 500);
    if (resposta.status === 401 || resposta.status === 403)
      return {
        ok: false,
        detalhe: `Credenciais recusadas pela Z-API (${resposta.status}). Confira o ZAPI_CLIENT_TOKEN na aba Segurança e o token da instância.`,
      };
    if (resposta.status === 404)
      return {
        ok: false,
        detalhe: "Instância não encontrada (404). Confira o ZAPI_INSTANCE_ID e o ZAPI_INSTANCE_TOKEN.",
      };
    if (!resposta.ok)
      return { ok: false, detalhe: `Z-API respondeu ${resposta.status}: ${corpo}` };

    let json: { connected?: boolean; error?: string; smartphoneConnected?: boolean } = {};
    try {
      json = JSON.parse(corpo);
    } catch {
      return { ok: false, detalhe: `Resposta inesperada da Z-API: ${corpo}` };
    }
    if (json.error) return { ok: false, detalhe: `Z-API: ${json.error}` };
    if (json.connected === false)
      return {
        ok: true,
        conectado: false,
        detalhe: "Credenciais válidas, mas a instância está desconectada — leia o QR Code no painel da Z-API.",
      };
    return { ok: true, conectado: true, detalhe: "Credenciais válidas e instância conectada." };
  } catch (e) {
    return {
      ok: false,
      detalhe: e instanceof Error ? `Falha de rede ao falar com a Z-API: ${e.message}` : "Falha de rede",
    };
  }
}


/** Envia o resumo por WhatsApp usando a Z-API (instância própria). */
export async function enviarWhatsappZapi(
  perfil: AvisoPerfil,
  resumo: AvisoResumo,
): Promise<ResultadoCanal> {
  if (!perfil.whatsapp) {
    return { enviado: false, status: "sem_whatsapp", detalhe: "Nenhum número cadastrado" };
  }
  const fone = normalizarWhatsapp(perfil.whatsapp);
  if (!fone.valido) {
    return {
      enviado: false,
      status: "sem_whatsapp",
      detalhe: fone.motivo ?? "Número de WhatsApp inválido (informe DDD + número)",
      definitivo: true,
    };
  }

  const status = verificarZapi();
  if (!status.pronto) {
    return {
      enviado: false,
      status: "sem_zapi",
      detalhe: status.mensagem,
      definitivo: true,
    };
  }
  const instancia = process.env.ZAPI_INSTANCE_ID!.trim();
  const token = process.env.ZAPI_INSTANCE_TOKEN!.trim();
  const clientToken = process.env.ZAPI_CLIENT_TOKEN!.trim();


  const url = `https://api.z-api.io/instances/${instancia}/token/${token}/send-text`;
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (clientToken) headers["Client-Token"] = clientToken;

    const resposta = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        phone: fone.digitos,
        message: resumo.texto.slice(0, 3000),
      }),
    });
    const corpo = await resposta.text();
    if (!resposta.ok) {
      console.error(`[avisos] Z-API falhou [${resposta.status}]: ${corpo}`);
      return {
        enviado: false,
        status: `falha:${resposta.status}`,
        detalhe: corpo.slice(0, 500),
        // credenciais/instância inválidas não se resolvem com nova tentativa
        definitivo: resposta.status === 401 || resposta.status === 403 || resposta.status === 404,
      };
    }
    // A Z-API pode responder 200 com { error: "..." }
    try {
      const json = JSON.parse(corpo) as { error?: string; messageId?: string };
      if (json?.error) {
        console.error(`[avisos] Z-API erro no corpo: ${json.error}`);
        return { enviado: false, status: "falha", detalhe: String(json.error).slice(0, 500) };
      }
      return {
        enviado: true,
        status: "enviado",
        detalhe: `${resumo.assunto}${json?.messageId ? ` (id ${json.messageId})` : ""}`,
      };
    } catch {
      return { enviado: true, status: "enviado", detalhe: resumo.assunto };
    }
  } catch (error) {
    const detalhe = error instanceof Error ? error.message : "erro desconhecido";
    console.error("[avisos] Z-API erro", detalhe);
    return { enviado: false, status: "falha", detalhe: detalhe.slice(0, 500) };
  }
}

/**
 * Envia o resumo por WhatsApp. Usa a Z-API quando configurada e,
 * na falta dela, o Twilio pelo gateway de conectores.
 */
export async function enviarWhatsapp(
  perfil: AvisoPerfil,
  resumo: AvisoResumo,
): Promise<ResultadoCanal> {
  const zapi = verificarZapi();
  if (zapi.pronto) return enviarWhatsappZapi(perfil, resumo);
  // Z-API parcialmente configurada é erro de configuração, não motivo para cair no Twilio
  const parcial = Object.values(zapi.presentes).some(Boolean);
  if (parcial) {
    return { enviado: false, status: "sem_zapi", detalhe: zapi.mensagem, definitivo: true };
  }
  return enviarWhatsappTwilio(perfil, resumo);
}


/** Envia o resumo por WhatsApp usando o Twilio pelo gateway de conectores. */
export async function enviarWhatsappTwilio(
  perfil: AvisoPerfil,
  resumo: AvisoResumo,
): Promise<ResultadoCanal> {
  if (!perfil.whatsapp) {
    return { enviado: false, status: "sem_whatsapp", detalhe: "Nenhum número cadastrado" };
  }
  const lovableKey = process.env.LOVABLE_API_KEY;
  const twilioKey = process.env.TWILIO_API_KEY;
  if (!lovableKey || !twilioKey) {
    return {
      enviado: false,
      status: "sem_twilio",
      detalhe: "Conecte o Twilio (WhatsApp) para ativar o envio automático",
    };
  }
  const from = process.env.TWILIO_WHATSAPP_FROM || "+14155238886"; // sandbox do Twilio

  try {
    const resposta = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: `whatsapp:${telefoneE164(perfil.whatsapp)}`,
        From: `whatsapp:${from.startsWith("+") ? from : `+${from}`}`,
        Body: resumo.texto.slice(0, 1500),
      }),
    });
    if (!resposta.ok) {
      const corpo = await resposta.text();
      console.error(`[avisos] WhatsApp falhou [${resposta.status}]: ${corpo}`);
      return {
        enviado: false,
        status: `falha:${resposta.status}`,
        detalhe: corpo.slice(0, 500),
      };
    }
    return { enviado: true, status: "enviado", detalhe: resumo.assunto };
  } catch (error) {
    const detalhe = error instanceof Error ? error.message : "erro desconhecido";
    console.error("[avisos] WhatsApp erro", detalhe);
    return { enviado: false, status: "falha", detalhe: detalhe.slice(0, 500) };
  }
}

/** Codifica a mensagem RFC 2822 em base64url (formato exigido pelo Gmail). */
function mensagemGmail(para: string, assunto: string, html: string, texto: string): string {
  const assuntoMime = `=?UTF-8?B?${Buffer.from(assunto, "utf8").toString("base64")}?=`;
  const fronteira = "aviso_boundary_agenda";
  const email = [
    `To: ${para}`,
    `Subject: ${assuntoMime}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${fronteira}"`,
    "",
    `--${fronteira}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(texto, "utf8").toString("base64"),
    `--${fronteira}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(html, "utf8").toString("base64"),
    `--${fronteira}--`,
    "",
  ].join("\r\n");
  return Buffer.from(email, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Envia o resumo pelo Gmail conectado (gateway de conectores). */
export async function enviarEmailGmail(
  perfil: AvisoPerfil,
  resumo: AvisoResumo,
): Promise<ResultadoCanal> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const gmailKey = process.env.GOOGLE_MAIL_API_KEY;
  if (!lovableKey || !gmailKey) {
    return {
      enviado: false,
      status: "sem_gmail",
      detalhe: "Gmail não conectado",
      definitivo: true,
    };
  }
  try {
    const resposta = await fetch(
      "https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": gmailKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw: mensagemGmail(perfil.notify_email!, resumo.assunto, resumo.html, resumo.texto),
        }),
      },
    );
    if (!resposta.ok) {
      const corpo = await resposta.text();
      console.error(`[avisos] Gmail falhou [${resposta.status}]: ${corpo}`);
      
      // Detalhe extraído do erro do Google/Gmail 401
      let erroDetalhado = corpo.slice(0, 500);
      try {
        const json = JSON.parse(corpo);
        if (json.error?.message) erroDetalhado = json.error.message;
      } catch (e) {}

      return {
        enviado: false,
        status: `falha:${resposta.status}`,
        detalhe: erroDetalhado,
        definitivo: resposta.status === 401 || resposta.status === 403,
      };
    }
    return { enviado: true, status: "enviado", detalhe: resumo.assunto };
  } catch (error) {
    const detalhe = error instanceof Error ? error.message : "erro desconhecido";
    return { enviado: false, status: "falha", detalhe: detalhe.slice(0, 500) };
  }
}

export type ResultadoEnvio = {
  enviado: boolean;
  status: string;
  detalhe: string;
  resumo: AvisoResumo;
  whatsapp?: ResultadoCanal;
};

export type TipoAviso =
  | "diario"
  | "teste"
  | "vencimento_d1"
  | "vencimento_d0"
  | "vencido";

const KIND_POR_TIPO: Record<TipoAviso, string> = {
  diario: "aviso_diario",
  teste: "aviso_teste",
  vencimento_d1: "aviso_vencimento_d1",
  vencimento_d0: "aviso_vencimento_d0",
  vencido: "aviso_vencido",

};

/**
 * Envia o resumo por e-mail e, quando ativado, também por WhatsApp.
 * Registra o resultado em notification_log (chave única por usuário/tipo/dia/canal).
 */
export async function enviarResumo(
  perfil: AvisoPerfil,
  opcoes: { tipo: TipoAviso; ignorarVazio?: boolean; resumo?: AvisoResumo } = { tipo: "diario" },
): Promise<ResultadoEnvio> {
  const resumo = opcoes.resumo ?? (await montarResumo(perfil));
  const hoje = todayISO();
  const kind = KIND_POR_TIPO[opcoes.tipo];

  if (resumo.vazio && !opcoes.ignorarVazio) {
    return { enviado: false, status: "sem_pendencias", detalhe: "Nada a avisar hoje", resumo };
  }

  const registrar = (channel: string, r: ResultadoCanal) =>
    supabaseAdmin.from("notification_log").upsert(
      {
        user_id: perfil.id,
        kind,
        ref_date: hoje,
        channel,
        status: r.status.slice(0, 120),
        detail: `${r.tentativas ? `tentativas: ${r.tentativas} — ` : ""}${r.detalhe}`.slice(0, 500),
      },
      { onConflict: "user_id,kind,ref_date,channel" },
    );

  let whatsapp: ResultadoCanal | undefined;
  if (perfil.notify_whatsapp && perfil.whatsapp) {
    whatsapp = await comRepeticao("whatsapp", () => enviarWhatsapp(perfil, resumo));
    await registrar("whatsapp", whatsapp);
  }

  if (!perfil.notify_email) {
    return {
      enviado: Boolean(whatsapp?.enviado),
      status: whatsapp?.status ?? "sem_email",
      detalhe: whatsapp?.detalhe ?? "Nenhum e-mail configurado",
      resumo,
      whatsapp,
    };
  }

  // Com o Gmail conectado, ele é o remetente; senão, cai no e-mail gerenciado.
  const usarGmail = Boolean(process.env.GOOGLE_MAIL_API_KEY && process.env.LOVABLE_API_KEY);
  const email = await comRepeticao("email", async () => {
    if (usarGmail) return enviarEmailGmail(perfil, resumo);
    try {
      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) {
        console.error("[avisos:email] LOVABLE_API_KEY não encontrada no process.env");
        return {
          enviado: false,
          status: "sem_config",
          detalhe: "LOVABLE_API_KEY não configurada nos segredos do projeto",
          definitivo: true,
        };
      }
      const data = {
        to: perfil.notify_email!,
        from: remetente(),
        subject: resumo.assunto,
        html: resumo.html,
        text: resumo.texto,
        label: `aviso-${opcoes.tipo}`,
      };
      console.log(`[avisos:email] Enviando via Lovable: to=${data.to}, subject=${data.subject}`);
      const resposta = await sendLovableEmail(data, {
        apiKey,
        idempotencyKey: `${perfil.id}:${opcoes.tipo}:${hoje}`,
      });
      console.log(`[avisos:email] Resposta Lovable: success=${resposta.success}, status=${resposta.status}`);
      if (resposta.success) return { enviado: true, status: "enviado", detalhe: resumo.assunto };
      return {
        enviado: false,
        status: "falha",
        detalhe: resposta.status ?? "envio não confirmado",
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[avisos:email] Erro ao disparar e-mail para ${perfil.notify_email}:`, error);
      const detalhe = (
        msg.includes("API key") || msg.includes("Unauthorized") 
          ? "Erro de autenticação na API de e-mail. Verifique a LOVABLE_API_KEY."
          : msg
      ).slice(0, 500);
      return {
        enviado: false,
        status: error instanceof EmailAPIError ? `falha:${error.message}`.slice(0, 120) : "falha",
        detalhe,
        // Domínio não verificado / remetente inválido não melhora com retry.
        definitivo: /domain|dom[íi]nio|verif|from|sender|forbidden|401|403/i.test(detalhe),
      };
    }
  });

  await registrar("email", email);

  return {
    enviado: email.enviado || Boolean(whatsapp?.enviado),
    status: email.status,
    detalhe: email.detalhe,
    resumo,
    whatsapp,
  };
}


/** Já foi enviado o aviso diário de hoje para este usuário (em qualquer canal)? */
/** Já houve envio bem-sucedido hoje para um tipo específico de aviso? */
export async function jaEnviadoKindHoje(userId: string, kind: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("notification_log")
    .select("status")
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("ref_date", todayISO());
  if (error) throw error;
  const linhas = (data ?? []).map((r) => String(r.status));
  if (!linhas.length) return false;
  return linhas.every((s) => s.startsWith("enviado") || STATUS_DEFINITIVOS.includes(s));
}

/** Envia os avisos de vencimento (véspera, no dia e contas em atraso). */
export async function enviarAvisosVencimento(perfil: AvisoPerfil): Promise<
  { tipo: TipoAviso; enviado: boolean; status: string; detalhe: string }[]
> {
  const etapas: { tipo: TipoAviso; quando: "amanha" | "hoje" | "vencidas" }[] = [
    { tipo: "vencimento_d1", quando: "amanha" },
    { tipo: "vencimento_d0", quando: "hoje" },
    { tipo: "vencido", quando: "vencidas" },
  ];

  const saidas: { tipo: TipoAviso; enviado: boolean; status: string; detalhe: string }[] = [];
  for (const etapa of etapas) {
    if (await jaEnviadoKindHoje(perfil.id, KIND_POR_TIPO[etapa.tipo])) continue;
    const resumo = await montarResumoVencimento(perfil, etapa.quando);
    if (resumo.vazio) continue;
    const r = await enviarResumo(perfil, { tipo: etapa.tipo, resumo });
    saidas.push({ tipo: etapa.tipo, enviado: r.enviado, status: r.status, detalhe: r.detalhe });
  }
  return saidas;
}

export async function jaEnviadoHoje(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("notification_log")
    .select("id, status")
    .eq("user_id", userId)
    .eq("kind", "aviso_diario")
    .eq("ref_date", todayISO());
  if (error) throw error;
  return (data ?? []).some((r) => String(r.status).startsWith("enviado"));
}

/**
 * Deve parar de tentar hoje? Verdadeiro quando já foi enviado ou quando a falha
 * é definitiva (falta de configuração), evitando reenvios inúteis a cada hora.
 */
export async function pararTentativasHoje(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("notification_log")
    .select("status")
    .eq("user_id", userId)
    .eq("kind", "aviso_diario")
    .eq("ref_date", todayISO());
  if (error) throw error;
  const linhas = (data ?? []).map((r) => String(r.status));
  if (!linhas.length) return false;
  return linhas.every((s) => s.startsWith("enviado") || STATUS_DEFINITIVOS.includes(s));
}

