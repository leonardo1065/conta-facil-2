import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { monthlyEntries, monthlyHealth, panelEntries } from "./monthly-panel";
import type { Entry } from "./finance";
import type { HealthEvent } from "./health";

const entry = (overrides: Partial<Entry> = {}): Entry => ({ id: "oct", user_id: "owner", description: "Luz", amount: 100, due_date: "2026-10-18", category_id: "casa", kind: "despesa", status: "pendente", paid_at: null, notes: null, attachment_path: null, barcode: null, series_id: "series", is_recurring: true, recurrence_interval_months: 1, recurrence_unit: "mes", installment_no: null, installment_total: null, is_avulsa: false, daily_archived: false, month_ref: null, ...overrides });

describe("gestão mensal do painel", () => {
  test("salário e outras entradas aparecem como receitas do mês, recebidas ou a receber", () => {
    const rows = [
      entry({ id: "salario", description: "Salário", kind: "receita", amount: 3000, status: "pago" }),
      entry({ id: "entrada", description: "Outras entradas", kind: "receita", amount: 200, is_avulsa: true }),
      entry({ id: "receita", description: "Receitas", kind: "receita", amount: 100 }),
      entry({ id: "novembro", kind: "receita", amount: 500, due_date: "2026-11-05" }),
      entry(),
    ];
    const original = structuredClone(rows);
    const october = monthlyEntries(rows, "2026-10");
    const income = panelEntries(october, "receitas", "2026-10-20");
    assert.deepEqual(income.map((row) => row.id), ["salario", "entrada", "receita"]);
    assert.equal(income.reduce((total, row) => total + row.amount, 0), 3300);
    assert.deepEqual(panelEntries(october, "todos", "2026-10-20").map((row) => row.id), ["salario", "entrada", "receita", "oct"]);
    assert.deepEqual(rows, original);
  });
  test("outubro e novembro mostram somente contas cadastradas no mês escolhido", () => {
    const rows = [entry(), entry({ id: "nov", due_date: "2026-11-01" })];
    assert.deepEqual(monthlyEntries(rows, "2026-10").map((row) => row.id), ["oct"]);
    assert.deepEqual(monthlyEntries(rows, "2026-11").map((row) => row.id), ["nov"]);
    assert.equal(monthlyEntries(rows, "2026-12").length, 0);
  });
  test("permite todas as categorias, uma categoria ou sem categoria", () => {
    const rows = [entry(), entry({ id: "none", category_id: null })];
    assert.equal(monthlyEntries(rows, "2026-10").length, 2);
    assert.deepEqual(monthlyEntries(rows, "2026-10", "casa").map((row) => row.id), ["oct"]);
    assert.deepEqual(monthlyEntries(rows, "2026-10", "sem").map((row) => row.id), ["none"]);
  });
  test("separa pendentes, vencendo hoje, pagos e vencidos", () => {
    const rows = [entry(), entry({ id: "late", due_date: "2026-10-17" }), entry({ id: "paid", status: "pago" }), entry({ id: "future", due_date: "2026-10-19" })];
    const ids = (view: "pendentes" | "hoje" | "pagos" | "vencidos") => panelEntries(rows, view, "2026-10-18").map((row) => row.id);
    assert.deepEqual(ids("pendentes"), ["oct", "late", "future"]);
    assert.deepEqual(ids("hoje"), ["oct"]);
    assert.deepEqual(ids("pagos"), ["paid"]);
    assert.deepEqual(ids("vencidos"), ["late"]);
  });
  test("recorrentes incluem prestações mas não contas comuns", () => {
    assert.deepEqual(panelEntries([entry(), entry({ id: "part", is_recurring: false, installment_total: 6 }), entry({ id: "single", is_recurring: false })], "recorrentes", "2026-10-18").map((row) => row.id), ["oct", "part"]);
  });
  test("diárias mantêm os totais sem virar pendências ou vencimentos", () => {
    const rows = monthlyEntries([entry({ is_avulsa: true, amount: 35, due_date: "2026-10-31" })], "2026-10");
    assert.equal(rows.reduce((total, row) => total + row.amount, 0), 35);
    assert.equal(panelEntries(rows, "pendentes", "2026-11-01").length, 0);
    assert.equal(panelEntries(rows, "vencidos", "2026-11-01").length, 0);
  });
  test("saúde acompanha o mês escolhido", () => {
    const rows = [{ id: "oct", scheduled_date: "2026-10-18" }, { id: "nov", scheduled_date: "2026-11-02" }] as HealthEvent[];
    assert.deepEqual(monthlyHealth(rows, "2026-11").map((row) => row.id), ["nov"]);
  });
});