import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildDailyHistory, formatAdditionDate, latestDailyAddition } from "./daily-history";
import type { Entry } from "./finance";

const entry = (overrides: Partial<Entry> = {}): Entry => ({ id: "account", user_id: "owner", description: "Padaria", amount: 0, due_date: "2026-10-30", category_id: null, kind: "despesa", status: "pendente", paid_at: null, notes: null, attachment_path: null, barcode: null, series_id: "series", is_recurring: false, recurrence_interval_months: 1, recurrence_unit: "mes", installment_no: null, installment_total: null, is_avulsa: true, daily_archived: false, month_ref: "2026-10", ...overrides });

describe("histórico de valores das diárias", () => {
  test("cadastros zerados não são gastos no histórico", () => {
    assert.deepEqual(buildDailyHistory(Array.from({ length: 10 }, (_, i) => entry({ id: String(i), series_id: String(i) })), []), []);
  });
  test("preserva o total antigo sem inventar uma data de inclusão", () => {
    const history = buildDailyHistory([entry({ amount: 35 })], []);
    assert.equal(history[0]?.total, 35);
    assert.equal(history[0]?.accounts[0]?.values[0]?.date, null);
  });
  test("mostra valores exatos datados sem duplicar o total", () => {
    const values = [{ id: "new", entry_id: "account", amount: 12.34, added_at: "2026-10-17T12:03:00Z" }];
    const history = buildDailyHistory([entry({ amount: 47.34 })], values);
    assert.deepEqual(history[0]?.accounts[0]?.values.map((value) => value.amount), [35, 12.34]);
    assert.equal(history[0]?.total, 47.34);
    assert.equal(formatAdditionDate(values[0].added_at), "17/10/2026");
    assert.equal(latestDailyAddition(values, "account"), values[0].added_at);
  });
  test("diárias arquivadas continuam no histórico", () => {
    assert.equal(buildDailyHistory([entry({ amount: 15, daily_archived: true })], [])[0]?.total, 15);
  });
});