import { addDays } from "./dates";

export type ParsedDocument = {
  kind: "boleto" | "pix" | "desconhecido";
  amount?: number;
  dueDate?: string;
  recipient?: string;
  city?: string;
  txid?: string;
  dynamicUrl?: string;
  raw: string;
};

const BOLETO_BASE_DATE = "1997-10-07"; // fator de vencimento base FEBRABAN
const BOLETO_RESET_BASE_DATE = "2022-05-29"; // fator 1000 voltou a valer em 22/02/2025

/** Fator de vencimento simples: base + nº de dias */
function dataDoFator(factor: number): string | undefined {
  if (!factor || factor < 1000) return undefined;
  return addDays(factor <= 1999 ? BOLETO_RESET_BASE_DATE : BOLETO_BASE_DATE, factor);
}

/** Boleto de arrecadação / conta de consumo (começa com 8) */
function parseArrecadacao(digits: string): ParsedDocument | null {
  const barcode =
    digits.length === 48
      ? digits.slice(0, 11) + digits.slice(12, 23) + digits.slice(24, 35) + digits.slice(36, 47)
      : digits;
  if (barcode.length !== 44 || barcode[0] !== "8") return null;

  const bruto = Number(barcode.slice(4, 15));
  const amount = bruto > 0 ? bruto / 100 : undefined;

  return { kind: "boleto", amount, raw: digits };
}

function normalizeAmount(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : undefined;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return undefined;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

function normalizeDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : undefined;
}

/** Linha digitável (47) ou código de barras (44) de boleto bancário */
function parseBoleto(digits: string): ParsedDocument | null {
  let barcode = digits;
  if (digits.length === 47) {
    barcode =
      digits.slice(0, 4) + // banco + moeda
      digits.slice(32, 47) + // DV geral + fator + valor
      digits.slice(4, 9) +
      digits.slice(10, 20) +
      digits.slice(21, 31);
  }
  if (barcode.length !== 44) return null;
  if (barcode[0] === "8") return parseArrecadacao(barcode);

  const factor = Number(barcode.slice(5, 9));
  const value = Number(barcode.slice(9, 19)) / 100;

  return {
    kind: "boleto",
    amount: Number.isFinite(value) && value > 0 ? value : undefined,
    dueDate: dataDoFator(factor),
    raw: digits,
  };
}

type TlvField = { id: string; value: string };

function parseTlv(payload: string): TlvField[] {
  const bytes = new TextEncoder().encode(payload);
  const decoder = new TextDecoder();
  const fields: TlvField[] = [];
  let offset = 0;

  while (offset + 4 <= bytes.length) {
    const id = decoder.decode(bytes.slice(offset, offset + 2));
    const lengthText = decoder.decode(bytes.slice(offset + 2, offset + 4));
    if (!/^\d{2}$/.test(lengthText)) break;
    const length = Number(lengthText);
    const start = offset + 4;
    const end = start + length;
    if (end > bytes.length) break;
    fields.push({ id, value: decoder.decode(bytes.slice(start, end)) });
    offset = end;
  }

  return fields;
}

function nestedField(value: string, id: string): string | undefined {
  return parseTlv(value).find((field) => field.id === id)?.value.trim() || undefined;
}

/** Payload Pix "copia e cola" (BR Code/EMV). */
function parsePix(payload: string): ParsedDocument | null {
  // O Pix copia e cola não contém espaços. Alguns aplicativos quebram o
  // conteúdo em várias linhas ou inserem espaços ao copiar.
  const normalized = payload.replace(/[\s\u200B-\u200D\uFEFF]/g, "").trim();
  if (!normalized.toUpperCase().includes("BR.GOV.BCB.PIX")) return null;

  const fields = parseTlv(normalized);
  const amountValue = fields.find((field) => field.id === "54")?.value;
  const amount = normalizeAmount(amountValue);
  const merchantAccount = fields.find((field) => field.id >= "26" && field.id <= "51")?.value;
  const dynamicUrl = merchantAccount ? nestedField(merchantAccount, "25") : undefined;
  const additionalData = fields.find((field) => field.id === "62")?.value;

  return {
    kind: "pix",
    amount,
    recipient: fields.find((field) => field.id === "59")?.value.trim() || undefined,
    city: fields.find((field) => field.id === "60")?.value.trim() || undefined,
    txid: additionalData ? nestedField(additionalData, "05") : undefined,
    dynamicUrl,
    raw: normalized,
  };
}

function normalizeBoletoDigits(input: string): string {
  const ascii = input
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
  const compact = ascii.replace(/[\s.\-/\\]/g, "");

  // Corrige confusões comuns de leitura/digitação somente quando todo o
  // conteúdo tem aparência de uma linha numérica.
  if (/^[0-9OoIl|]+$/.test(compact)) {
    return compact.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1");
  }

  return ascii.replace(/\D/g, "");
}

/** Completa os dados de um Pix dinâmico pela URL pública contida no QR Code. */
export async function resolveDynamicPix(parsed: ParsedDocument): Promise<ParsedDocument> {
  if (parsed.kind !== "pix" || !parsed.dynamicUrl) return parsed;

  const rawUrl = parsed.dynamicUrl.startsWith("http") ? parsed.dynamicUrl : `https://${parsed.dynamicUrl}`;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return parsed;
  }
  if (url.protocol !== "https:") return parsed;

  try {
    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!response.ok) return parsed;
    const payload = (await response.json()) as {
      valor?: { original?: string | number };
      calendario?: { dataDeVencimento?: string; criacao?: string; expiracao?: number };
      devedor?: { nome?: string };
    };
    const directDueDate = normalizeDate(payload.calendario?.dataDeVencimento);
    let dueDate = directDueDate;
    if (!dueDate && payload.calendario?.criacao && payload.calendario.expiracao) {
      const expiresAt = new Date(
        new Date(payload.calendario.criacao).getTime() + payload.calendario.expiracao * 1000,
      );
      if (!Number.isNaN(expiresAt.getTime())) dueDate = expiresAt.toISOString().slice(0, 10);
    }
    return {
      ...parsed,
      amount: normalizeAmount(payload.valor?.original) ?? parsed.amount,
      dueDate: dueDate ?? parsed.dueDate,
      recipient: parsed.recipient ?? (payload.devedor?.nome?.trim() || undefined),
    };
  } catch {
    return parsed;
  }
}

export function parseScannedCode(input: string): ParsedDocument {
  const raw = input.normalize("NFKC").trim();
  const digits = normalizeBoletoDigits(raw);

  const pix = parsePix(raw);
  if (pix) return pix;

  if (digits.length === 44 || digits.length === 47) {
    const boleto = parseBoleto(digits);
    if (boleto) return boleto;
  }

  if (digits.length === 48) {
    const arrecadacao = parseArrecadacao(digits);
    if (arrecadacao) return arrecadacao;
  }

  return { kind: "desconhecido", raw };
}

export function invalidCodeMessage(input: string): string {
  const raw = input.normalize("NFKC").trim();
  const digits = normalizeBoletoDigits(raw);

  if (/BR\.GOV\.BCB\.PIX/i.test(raw)) {
    return "O código Pix está incompleto ou foi alterado ao copiar. Copie novamente todo o Pix copia e cola.";
  }
  if (digits.length > 0) {
    return `Foram reconhecidos ${digits.length} números. A linha precisa ter 44, 47 ou 48 números completos.`;
  }
  return "O texto informado não é um Pix copia e cola nem uma linha digitável de boleto.";
}
