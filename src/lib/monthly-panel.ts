import type { Entry } from "./finance";
import type { HealthEvent } from "./health";

export type PanelView = "todos" | "receitas" | "recorrentes" | "pendentes" | "hoje" | "pagos" | "vencidos" | "saude";

export function monthlyEntries(entries: Entry[], month: string, category = "todas") {
  return entries.filter((entry) => entry.due_date.slice(0, 7) === month &&
    (category === "todas" || (category === "sem" ? entry.category_id === null : entry.category_id === category)));
}

export function panelEntries(entries: Entry[], view: PanelView, today: string) {
  return entries.filter((entry) => {
    switch (view) {
      case "receitas": return entry.kind === "receita";
      case "recorrentes": return entry.is_recurring || (entry.installment_total ?? 0) > 1;
      case "pendentes": return !entry.is_avulsa && entry.status === "pendente";
      case "hoje": return !entry.is_avulsa && entry.kind === "despesa" && entry.status === "pendente" && entry.due_date === today;
      case "pagos": return entry.status === "pago";
      case "vencidos": return !entry.is_avulsa && entry.kind === "despesa" && entry.status === "pendente" && entry.due_date < today;
      case "saude": return false;
      default: return !entry.is_avulsa || entry.kind === "receita";
    }
  });
}

export function monthlySummary(entries: Entry[], today: string) {
  const total = (rows: Entry[]) => rows.reduce((acc, row) => acc + row.amount, 0);
  const expenses = entries.filter((entry) => entry.kind === "despesa");
  const daily = total(expenses.filter((entry) => entry.is_avulsa));
  const paid = total(expenses.filter((entry) => !entry.is_avulsa && entry.status === "pago"));
  const remaining = total(expenses.filter((entry) => !entry.is_avulsa && entry.status === "pendente"));
  const toPay = total(expenses);
  const income = total(panelEntries(entries, "receitas", today).filter((entry) => entry.status === "pago"));
  return { toPay, paid, daily, income, balance: toPay - income, remaining };
}

export function monthlyHealth(events: HealthEvent[], month: string) {
  return events.filter((event) => event.scheduled_date.slice(0, 7) === month);
}