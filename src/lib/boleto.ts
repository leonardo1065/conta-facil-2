import { addDays } from "./dates";

export type ParsedDocument = {
  kind: "boleto" | "pix" | "desconhecido";
  amount?: number;
  dueDate?: string;
  recipient?: string;
  city?: string;
  txid?: string;
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
  const barcode = digits.length === 48 ? digits.slice(0, 44) : digits;
  if (barcode.length !== 44 || barcode[0] !== "8") return null;

  const bruto = Number(barcode.slice(4, 15));
  const amount = bruto > 0 ? bruto / 100 : undefined;

  return { kind: "boleto", amount, raw: digits };
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
  const normalized = payload.replace(/[\r\n]/g, "").trim();
  if (!normalized.toUpperCase().includes("BR.GOV.BCB.PIX")) return null;

  const fields = parseTlv(normalized);
  const amountValue = fields.find((field) => field.id === "54")?.value;
  const amount = amountValue ? Number(amountValue) : undefined;
  const additionalData = fields.find((field) => field.id === "62")?.value;

  return {
    kind: "pix",
    amount: amount && Number.isFinite(amount) && amount > 0 ? amount : undefined,
    recipient: fields.find((field) => field.id === "59")?.value.trim() || undefined,
    city: fields.find((field) => field.id === "60")?.value.trim() || undefined,
    txid: additionalData ? nestedField(additionalData, "05") : undefined,
    raw: normalized,
  };
}

export function parseScannedCode(input: string): ParsedDocument {
  const raw = input.trim();
  const digits = raw.replace(/\D/g, "");

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
