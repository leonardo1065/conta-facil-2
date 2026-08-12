// Modelo (template) do e-mail de aviso: tags, valores padrão e renderização.
// Usado tanto no navegador (editor/prévia) quanto no servidor (envio real).

export type TemplateContexto = {
  nome: string;
  saudacao: string;
  titulo: string;
  data: string;
  quantidade: string;
  total: string;
  /** Lista de contas, uma por linha (sem marcador). */
  itens: string[];
};

export const TAGS: { tag: string; descricao: string }[] = [
  { tag: "{{saudacao}}", descricao: "Olá, Nome! (ou apenas Olá!)" },
  { tag: "{{nome}}", descricao: "Seu nome cadastrado" },
  { tag: "{{titulo}}", descricao: "Título do aviso (ex.: Vence hoje)" },
  { tag: "{{data}}", descricao: "Data de vencimento de referência" },
  { tag: "{{quantidade}}", descricao: "Quantidade de contas" },
  { tag: "{{total}}", descricao: "Total em R$ das contas listadas" },
  { tag: "{{lista}}", descricao: "Lista das contas (uma por linha)" },
];

export const ASSUNTO_PADRAO = "{{titulo}} — {{quantidade}} conta(s) de {{total}}";

export const CORPO_PADRAO = [
  "{{saudacao}}",
  "",
  "{{titulo}} ({{data}}):",
  "",
  "{{lista}}",
  "",
  "Total: {{total}}",
].join("\n");

/** Exemplo usado na prévia do editor. */
export const CONTEXTO_EXEMPLO: TemplateContexto = {
  nome: "Leonardo",
  saudacao: "Olá, Leonardo!",
  titulo: "Vence hoje",
  data: "01/08/2026",
  quantidade: "3",
  total: "R$ 1.284,90",
  itens: [
    "Luz — R$ 312,40 — vence 01/08/2026",
    "Internet — R$ 129,90 — vence 01/08/2026",
    "Prestação de carro — R$ 842,60 — vence 01/08/2026",
  ],
};

function escaparHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function substituir(modelo: string, ctx: TemplateContexto, lista: string): string {
  return modelo
    .replace(/\{\{\s*saudacao\s*\}\}/gi, ctx.saudacao)
    .replace(/\{\{\s*nome\s*\}\}/gi, ctx.nome)
    .replace(/\{\{\s*titulo\s*\}\}/gi, ctx.titulo)
    .replace(/\{\{\s*data\s*\}\}/gi, ctx.data)
    .replace(/\{\{\s*quantidade\s*\}\}/gi, ctx.quantidade)
    .replace(/\{\{\s*total\s*\}\}/gi, ctx.total)
    .replace(/\{\{\s*lista\s*\}\}/gi, lista);
}

/** Aplica o modelo e devolve assunto, texto puro e HTML prontos para envio. */
export function renderizarTemplate(
  assuntoTpl: string | null | undefined,
  corpoTpl: string | null | undefined,
  ctx: TemplateContexto,
): { assunto: string; texto: string; html: string } {
  const assuntoModelo = (assuntoTpl ?? "").trim() || ASSUNTO_PADRAO;
  const corpoModelo = (corpoTpl ?? "").trim() || CORPO_PADRAO;

  const listaTexto = ctx.itens.map((i) => `• ${i}`).join("\n");
  const assunto = substituir(assuntoModelo, ctx, listaTexto).replace(/\s+/g, " ").trim();
  const texto = substituir(corpoModelo, ctx, listaTexto);

  const listaHtml = ctx.itens.length
    ? `<ul style="margin:0;padding-left:18px">${ctx.itens
        .map((i) => `<li style="margin:2px 0">${escaparHtml(i)}</li>`)
        .join("")}</ul>`
    : "<p style=\"margin:0\">Nenhuma conta no período.</p>";

  const ctxHtml: TemplateContexto = {
    ...ctx,
    nome: escaparHtml(ctx.nome),
    saudacao: escaparHtml(ctx.saudacao),
    titulo: escaparHtml(ctx.titulo),
    data: escaparHtml(ctx.data),
    quantidade: escaparHtml(ctx.quantidade),
    total: escaparHtml(ctx.total),
  };

  const corpoHtml = substituir(escaparHtml(corpoModelo), ctxHtml, "\u0000LISTA\u0000")
    .split("\n")
    .map((linha) => (linha.includes("\u0000LISTA\u0000") ? listaHtml : `<p style="margin:6px 0">${linha || "&nbsp;"}</p>`))
    .join("");

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#0f172a">${corpoHtml}</div>`;

  return { assunto, texto, html };
}
