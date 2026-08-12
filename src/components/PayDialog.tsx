import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DateField } from "@/components/DateField";
import { addDays, addMonths, todayISO } from "@/lib/dates";
import { useTogglePaid, type Entry } from "@/lib/finance";

export function proximaOcorrencia(entry: Entry) {
  const passo = Math.max(1, entry.recurrence_interval_months || 1);
  return entry.recurrence_unit === "semana"
    ? addDays(entry.due_date, passo * 7)
    : addMonths(entry.due_date, passo);
}

/** Diálogo de baixa com atalhos Hoje/Amanhã e data da próxima parcela quando recorrente. */
export function PayDialog({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  const alternarPago = useTogglePaid();
  const [dataPagamento, setDataPagamento] = useState(todayISO());
  const [proximaData, setProximaData] = useState("");

  useEffect(() => {
    if (!entry) return;
    setDataPagamento(todayISO());
    setProximaData(entry.is_recurring ? proximaOcorrencia(entry) : "");
  }, [entry]);

  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Data de pagamento</DialogTitle>
          <DialogDescription>“{entry?.description}”</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setDataPagamento(todayISO())}>
              Hoje
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setDataPagamento(addDays(todayISO(), 1))}
            >
              Amanhã
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="data-pagamento">Data</Label>
            <DateField id="data-pagamento" value={dataPagamento} onChange={setDataPagamento} />
          </div>

          {entry?.is_recurring && (
            <div className="space-y-2 rounded-xl border border-dashed border-info/60 p-3">
              <Label htmlFor="proxima-data">Próxima parcela</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setProximaData(proximaOcorrencia(entry))}
                >
                  {entry.recurrence_unit === "semana" ? "Próxima semana" : "Próximo mês"}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setProximaData(todayISO())}>
                  Hoje
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setProximaData(addDays(todayISO(), 1))}
                >
                  Amanhã
                </Button>
              </div>
              <DateField id="proxima-data" value={proximaData} onChange={setProximaData} />
              <p className="text-xs text-muted-foreground">
                A próxima parcela será criada nesta data com valor zerado.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (entry)
                alternarPago.mutate(
                  {
                    entry,
                    paidAt: dataPagamento || todayISO(),
                    nextDueDate: entry.is_recurring ? proximaData || null : null,
                  },
                  {
                    onSuccess: (gerouProxima) => {
                      toast.success("Marcado como pago.");
                      if (gerouProxima)
                        toast.info("Próxima parcela criada com valor zerado — informe o novo valor.");
                    },
                  },
                );
              onClose();
            }}
          >
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
