import { addDays } from "./dates";

export type ParsedDocument = {
  kind: "boleto" | "pix" | "desconhecido";
  amount?: number;
  dueDate?: string;
  raw: string;
};

const BOLETO_BASE_DATE = "1997-10-07"; // fator de vencimento base FEBRABAN

/** Fator de vencimento simples: base + nº de dias */
function dataDoFator(factor: number): string | undefined {
  if (!factor || factor < 1000) return undefined;
  return addDays(BOLETO_BASE_DATE, factor);
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

/** Payload Pix "copia e cola" (EMV) — extrai o valor do campo 54 */
function parsePix(payload: string): ParsedDocument | null {
  if (!payload.toUpperCase().includes("BR.GOV.BCB.PIX")) return null;
  let i = 0;
  let amount: number | undefined;
  while (i + 4 <= payload.length) {
    const len = Number(payload.slice(i + 2, i + 4));
    if (Number.isNaN(len)) break;
    const value = payload.slice(i + 4, i + 4 + len);
    if (payload.slice(i, i + 2) === "54") amount = Number(value);
    i += 4 + len;
  }
  return { kind: "pix", amount: amount && amount > 0 ? amount : undefined, raw: payload };
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
