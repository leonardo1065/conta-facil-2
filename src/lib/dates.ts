// Utilitários de data no fuso America/Sao_Paulo (GMT-3).
export const TZ = "America/Sao_Paulo";

const fmtISO = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data de hoje em São Paulo no formato yyyy-MM-dd */
export function todayISO(): string {
  return fmtISO.format(new Date());
}

/** Converte "yyyy-MM-dd" em Date local (sem deslocamento de fuso) */
export function parseISO(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: string, days: number): string {
  const d = parseISO(date);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function addMonths(date: string, months: number): string {
  const d = parseISO(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return toISO(d);
}

export function diffDays(from: string, to: string): number {
  const ms = parseISO(to).getTime() - parseISO(from).getTime();
  return Math.round(ms / 86400000);
}

export function monthRange(year: number, month: number) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start: toISO(start), end: toISO(end) };
}

const dayFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const longMonthFmt = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

export function formatDate(date: string): string {
  return dayFmt.format(parseISO(date));
}

export function formatMonth(d: Date): string {
  const label = longMonthFmt.format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/** Mês de referência ("yyyy-MM") de uma data ISO */
export function monthRef(date: string): string {
  return date.slice(0, 7);
}

/** Mês de referência do dia de hoje em São Paulo */
export function currentMonthRef(): string {
  return todayISO().slice(0, 7);
}

/** Último dia do mês de uma data ISO */
export function lastDayOfMonth(date: string): string {
  const d = parseISO(date);
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
