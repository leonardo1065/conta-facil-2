import { useState } from "react";
import { AlertTriangle, BellRing, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PayDialog } from "@/components/PayDialog";
import { formatBRL, formatDate } from "@/lib/dates";
import { sum, type DueBuckets } from "@/lib/dueBuckets";
import { cn } from "@/lib/utils";
import type { Entry } from "@/lib/finance";

/** Faixa de alerta no topo do painel para contas vencidas / vencendo, com baixa rápida. */
export function DueAlertBanner({ buckets }: { buckets: DueBuckets }) {
  const [aPagar, setAPagar] = useState<Entry | null>(null);
  const urgentes = [...buckets.vencidas, ...buckets.hoje];
  const total = urgentes.length + buckets.proximos.length;
  if (total === 0) return null;

  const critico = urgentes.length > 0;
  const lista = (critico ? urgentes : buckets.proximos)
    .slice()
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  return (
    <>
      <section
        role="alert"
        className={cn(
          "rounded-2xl border p-4 shadow-sm",
          critico
            ? "border-destructive/50 bg-destructive/10"
            : "border-warning/50 bg-warning/10",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "relative flex size-9 items-center justify-center rounded-full",
              critico ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning",
            )}
          >
            {critico ? <AlertTriangle className="size-5" /> : <BellRing className="size-5" />}
            <span
              className={cn(
                "absolute inset-0 animate-ping rounded-full opacity-40",
                critico ? "bg-destructive/40" : "bg-warning/40",
              )}
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn("font-semibold", critico ? "text-destructive" : "text-warning")}>
              {critico
                ? `${urgentes.length} conta(s) vencida(s) ou vencendo hoje`
                : `${buckets.proximos.length} conta(s) vencem nos próximos 7 dias`}
            </p>
            <p className="text-sm text-muted-foreground">
              Total de {formatBRL(sum(lista))} — pague com um clique.
            </p>
          </div>
        </div>

        <ul className="mt-3 space-y-2">
          {lista.slice(0, 4).map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-3 rounded-xl bg-card/80 px-3 py-2"
            >
              <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{entry.description}</p>
                <p className="text-xs text-muted-foreground">Vence em {formatDate(entry.due_date)}</p>
              </div>
              <span className="text-sm font-semibold tabular-nums">{formatBRL(entry.amount)}</span>
              <Button size="sm" onClick={() => setAPagar(entry)}>
                Pagar
              </Button>
            </li>
          ))}
        </ul>
        {lista.length > 4 && (
          <p className="mt-2 text-xs text-muted-foreground">
            +{lista.length - 4} conta(s) na lista abaixo.
          </p>
        )}
      </section>

      <PayDialog entry={aPagar} onClose={() => setAPagar(null)} />
    </>
  );
}
