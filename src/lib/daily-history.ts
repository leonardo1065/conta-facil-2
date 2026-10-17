import type { Entry } from "./finance";

export type DailyValue = { id: string; entry_id: string; amount: number; added_at: string };
export type DailyAccountHistory = {
  key: string;
  description: string;
  total: number;
  values: { id: string; amount: number; date: string | null }[];
};

export function buildDailyHistory(entries: Entry[], changes: DailyValue[]) {
  const byEntry = new Map<string, DailyValue[]>();
  for (const change of changes) {
    const items = byEntry.get(change.entry_id) ?? [];
    items.push(change);
    byEntry.set(change.entry_id, items);
  }
  const months = new Map<string, Map<string, DailyAccountHistory>>();
  for (const entry of entries) {
    if (!entry.is_avulsa) continue;
    const additions = byEntry.get(entry.id) ?? [];
    if (Number(entry.amount) === 0 && additions.length === 0) continue;
    const month = entry.month_ref ?? entry.due_date.slice(0, 7);
    const accounts = months.get(month) ?? new Map<string, DailyAccountHistory>();
    const key = entry.series_id ?? entry.id;
    const account = accounts.get(key) ?? { key, description: entry.description, total: 0, values: [] };
    account.total += Number(entry.amount);
    const previous = Math.round((Number(entry.amount) - additions.reduce((sum, item) => sum + Number(item.amount), 0)) * 100) / 100;
    if (previous !== 0) account.values.push({ id: `previous-${entry.id}`, amount: previous, date: null });
    account.values.push(...additions.map((item) => ({ id: item.id, amount: Number(item.amount), date: item.added_at })));
    accounts.set(key, account);
    months.set(month, accounts);
  }
  return [...months].sort(([a], [b]) => b.localeCompare(a)).map(([month, accounts]) => ({
    month,
    accounts: [...accounts.values()].sort((a, b) => a.description.localeCompare(b.description)).map((account) => ({
      ...account,
      values: account.values.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
    })),
    total: [...accounts.values()].reduce((sum, account) => sum + account.total, 0),
  }));
}

export function latestDailyAddition(changes: DailyValue[], entryId: string) {
  return changes.filter((item) => item.entry_id === entryId && Number(item.amount) > 0)
    .map((item) => item.added_at).sort().at(-1) ?? null;
}

export function formatAdditionDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(date));
}