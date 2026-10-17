import { describe, expect, test } from "bun:test";
import { buildDailyHistory, formatAdditionDate, latestDailyAddition } from "./daily-history";
import type { Entry } from "./finance";

const entry = (overrides: Partial<Entry> = {}): Entry => ({ id: "account", user_id: "owner", description: "Padaria", amount: 0, due_date: "2026-10-30", category_id: null, kind: "despesa", status: "pendente", paid_at: null, notes: null, attachment_path: null, barcode: null, series_id: "series", is_recurring: false, recurrence_interval_months: 1, recurrence_unit: "mes", installment_no: null, installment_total: null, is_avulsa: true, daily_archived: false, month_ref: "2026-10", ...overrides });

describe("histórico de valores das diárias", () => {
  test("cadastros zerados não são gastos no histórico", () => {
    expect(buildDailyHistory(Array.from({ length: 10 }, (_, i) => entry({ id: String(i), series_id: String(i) })), [])).toEqual([]);
  });
  test("preserva o total antigo sem inventar uma data de inclusão", () => {
    const history = buildDailyHistory([entry({ amount: 35 })], []);
    expect(history[0]?.total).toBe(35);
    expect(history[0]?.accounts[0]?.values[0]?.date).toBeNull();
  });
  test("mostra valores exatos datados sem duplicar o total", () => {
    const values = [{ id: "new", entry_id: "account", amount: 12.34, added_at: "2026-10-17T12:03:00Z" }];
    const history = buildDailyHistory([entry({ amount: 47.34 })], values);
    expect(history[0]?.accounts[0]?.values.map((value) => value.amount)).toEqual([35, 12.34]);
    expect(history[0]?.total).toBe(47.34);
    expect(formatAdditionDate(values[0].added_at)).toBe("17/10/2026");
    expect(latestDailyAddition(values, "account")).toBe(values[0].added_at);
  });
  test("diárias arquivadas continuam no histórico", () => {
    expect(buildDailyHistory([entry({ amount: 15, daily_archived: true })], [])[0]?.total).toBe(15);
  });
});