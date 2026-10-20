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

export function monthlyHealth(events: HealthEvent[], month: string) {
  return events.filter((event) => event.scheduled_date.slice(0, 7) === month);
}