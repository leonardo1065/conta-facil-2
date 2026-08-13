import { useState } from "react";
import { CheckCircle2, Circle, Pencil, Plus, Repeat, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PayDialog } from "@/components/PayDialog";
import { AvulsaAddDialog } from "@/components/AvulsaAddDialog";
import { cn } from "@/lib/utils";
import { currentMonthRef, diffDays, formatBRL, formatDate, todayISO } from "@/lib/dates";
import { useCategories, useDeleteEntry, useTogglePaid, type Entry } from "@/lib/finance";


export function statusInfo(entry: Entry) {
  if (entry.status === "pago")
    return {
      label: entry.kind === "receita" ? "Recebido" : "Pago",
      tone: "text-success",
      dot: "bg-success",
    };
  const delta = diffDays(todayISO(), entry.due_date);
  if (entry.kind === "receita") return { label: "A receber", tone: "text-info", dot: "bg-info" };
  if (delta < 0) return { label: `Vencida há ${Math.abs(delta)}d`, tone: "text-destructive", dot: "bg-destructive" };
  if (delta === 0) return { label: "Vence hoje", tone: "text-warning", dot: "bg-warning" };
  return { label: `Em ${delta} dia(s)`, tone: "text-muted-foreground", dot: "bg-muted-foreground" };
}

export function EntryList({
  entries,
  onEdit,
  empty = "Nenhum lançamento por aqui.",
}: {
  entries: Entry[];
  onEdit: (entry: Entry) => void;
  empty?: string;
}) {
  const { data: categories } = useCategories();
  const alternarPago = useTogglePaid();
  const excluir = useDeleteEntry();
  const [aExcluir, setAExcluir] = useState<Entry | null>(null);
  const [aPagar, setAPagar] = useState<Entry | null>(null);
  const [aSomar, setASomar] = useState<Entry | null>(null);

  if (entries.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }


  return (
    <>
      <ul className="space-y-2">
        {entries.map((entry) => {
          const info = statusInfo(entry);
          const categoria = categories?.find((c) => c.id === entry.category_id);
          return (
            <li
              key={entry.id}
              className="card-elevated flex items-center gap-3 px-3 py-3 sm:px-4"
            >
              <button
                type="button"
                aria-label={entry.status === "pago" ? "Marcar como pendente" : "Marcar como paga"}
                onClick={() => {
                  if (entry.status === "pago") {
                    alternarPago.mutate(
                      { entry, paidAt: null },
                      { onSuccess: () => toast.success("Marcado como pendente.") },
                    );
                  } else {
                    setAPagar(entry);
                  }
                }}



                className={cn("shrink-0", entry.status === "pago" ? "text-success" : "text-muted-foreground")}
              >
                {entry.status === "pago" ? (
                  <CheckCircle2 className="size-6" />
                ) : (
                  <Circle className="size-6" />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate font-medium">
                  <span className="truncate">{entry.description}</span>
                  {entry.is_recurring && (
                    <Repeat className="size-3.5 shrink-0 text-muted-foreground" aria-label="Conta fixa mensal" />
                  )}
                  {entry.is_avulsa && (
                    <Wallet className="size-3.5 shrink-0 text-muted-foreground" aria-label="Conta avulsa" />
                  )}
                </p>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  {categoria && (
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: categoria.color }}
                      />
                      {categoria.name}
                    </span>
                  )}
                  <span>{formatDate(entry.due_date)}</span>
                  {entry.is_avulsa && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 font-medium">
                      Avulsa{entry.month_ref === currentMonthRef() ? " · mês atual" : ""}
                    </span>
                  )}
                  {entry.installment_total && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 font-medium">
                      {entry.installment_no}/{entry.installment_total}
                    </span>
                  )}
                  <span className={cn("font-medium", info.tone)}>{info.label}</span>
                </p>
              </div>


              <div className="text-right">
                <p
                  className={cn(
                    "font-semibold tabular-nums",
                    entry.kind === "receita" ? "text-success" : "text-foreground",
                  )}
                >
                  {entry.kind === "receita" ? "+" : "-"}
                  {formatBRL(entry.amount)}
                </p>
              </div>

              <div className="flex shrink-0">
                {entry.is_avulsa && entry.status !== "pago" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Somar valor"
                    onClick={() => setASomar(entry)}
                  >
                    <Plus className="size-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => onEdit(entry)}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir"
                  onClick={() => setAExcluir(entry)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <PayDialog entry={aPagar} onClose={() => setAPagar(null)} />

      <AvulsaAddDialog entry={aSomar} onClose={() => setASomar(null)} />




      <AlertDialog open={!!aExcluir} onOpenChange={(o) => !o && setAExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              “{aExcluir?.description}” será removido definitivamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (aExcluir)
                  excluir.mutate(aExcluir.id, { onSuccess: () => toast.success("Lançamento excluído.") });
                setAExcluir(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
