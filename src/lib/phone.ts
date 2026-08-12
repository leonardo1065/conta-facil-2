/**
 * Normalização e validação de números de WhatsApp brasileiros em E.164.
 * Usado no formulário de configurações, no link wa.me e no envio pela Z-API.
 */

export type TelefoneNormalizado = {
  valido: boolean;
  /** Somente dígitos, com DDI (ex.: 5511967422171). */
  digitos: string;
  /** Formato E.164 (ex.: +5511967422171). Vazio quando inválido. */
  e164: string;
  /** Exibição amigável (ex.: +55 (11) 96742-2171). */
  formatado: string;
  motivo?: string;
};

const DDDS_VALIDOS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43,
  44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77,
  79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

function invalido(motivo: string, digitos = ""): TelefoneNormalizado {
  return { valido: false, digitos, e164: "", formatado: "", motivo };
}

/**
 * Aceita formatos comuns (com/sem DDI, com máscara, com 0 à frente, +55…)
 * e devolve o número em E.164. Celulares recebem o 9 quando vier sem ele.
 */
export function normalizarWhatsapp(entrada: string | null | undefined): TelefoneNormalizado {
  let so = (entrada ?? "").replace(/\D/g, "");
  if (!so) return invalido("Informe o número do WhatsApp com DDD");

  // remove zeros de operadora/tronco no início
  so = so.replace(/^0+/, "");
  if (so.startsWith("55") && so.length > 11) so = so.slice(2);
  so = so.replace(/^0+/, "");

  if (so.length < 10) return invalido("Número curto demais — use DDD + número", so);
  if (so.length > 11) return invalido("Número longo demais — use DDD + número", so);

  const ddd = Number(so.slice(0, 2));
  if (!DDDS_VALIDOS.has(ddd)) return invalido(`DDD ${so.slice(0, 2)} não existe`, so);

  let assinante = so.slice(2);
  if (assinante.length === 8 && /^[6-9]/.test(assinante)) assinante = `9${assinante}`; // celular antigo
  if (assinante.length === 9 && !/^9/.test(assinante))
    return invalido("Celular com 9 dígitos deve começar com 9", so);
  if (assinante.length === 8 && !/^[2-5]/.test(assinante))
    return invalido("Número fixo inválido para este DDD", so);

  const digitos = `55${ddd}${assinante}`;
  const meio = assinante.length === 9 ? assinante.slice(0, 5) : assinante.slice(0, 4);
  const fim = assinante.length === 9 ? assinante.slice(5) : assinante.slice(4);

  return {
    valido: true,
    digitos,
    e164: `+${digitos}`,
    formatado: `+55 (${ddd}) ${meio}-${fim}`,
  };
}

/** E.164 ou string vazia quando o número não for válido. */
export function telefoneE164BR(entrada: string | null | undefined): string {
  return normalizarWhatsapp(entrada).e164;
}

/** Somente dígitos com DDI 55 (formato exigido pela Z-API). */
export function telefoneDigitosBR(entrada: string | null | undefined): string {
  const r = normalizarWhatsapp(entrada);
  return r.valido ? r.digitos : "";
}
