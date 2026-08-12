import type { Entry } from "./finance";
import { diffDays, todayISO } from "./dates";

export type DueBuckets = {
  vencidas: Entry[];
  hoje: Entry[];
  proximos: Entry[];
};

export function getDueBuckets(entries: Entry[] | undefined): DueBuckets {
  const today = todayISO();
  const buckets: DueBuckets = { vencidas: [], hoje: [], proximos: [] };
  for (const entry of entries ?? []) {
    if (entry.status === "pago" || entry.kind !== "despesa") continue;
    const delta = diffDays(today, entry.due_date);
    if (delta < 0) buckets.vencidas.push(entry);
    else if (delta === 0) buckets.hoje.push(entry);
    else if (delta <= 7) buckets.proximos.push(entry);
  }
  return buckets;
}

export const sum = (entries: Entry[]) => entries.reduce((total, e) => total + e.amount, 0);
