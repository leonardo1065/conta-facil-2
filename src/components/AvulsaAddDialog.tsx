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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { currentMonthRef, formatBRL } from "@/lib/dates";
import { useAddToAvulsa, type Entry } from "@/lib/finance";

export function AvulsaAddDialog({
  entry,
  onClose,
}: {
  entry: Entry | null;
  onClose: () => void;
}) {
  const somar = useAddToAvulsa();
  const [valor, setValor] = useState("");

  useEffect(() => {
    if (entry) setValor("");
  }, [entry]);

  const mesAtual = entry?.month_ref === currentMonthRef();
  const acumulado = mesAtual ? (entry?.amount ?? 0) : 0;

  async function confirmar() {
    if (!entry) return;
    const v = Number(valor.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    try {
      const res = await somar.mutateAsync({ entry, valor: v });
      toast.success(
        res?.novoMes
          ? "Novo mês iniciado: valor lançado do zero."
          : `Somado. Total do mês: ${formatBRL(acumulado + v)}`,
      );
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao somar valor.");
    }
  }

  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Somar valor — {entry?.description}</DialogTitle>
          <DialogDescription>
            Conta avulsa: os valores somam durante o mês e recomeçam do zero no dia 1º.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Acumulado do mês: <span className="font-semibold text-foreground">{formatBRL(acumulado)}</span>
          </p>
          <div className="space-y-2">
            <Label htmlFor="valor-avulso">Valor a somar (R$)</Label>
            <Input
              id="valor-avulso"
              inputMode="decimal"
              autoFocus
              value={valor}
              placeholder="0,00"
              onChange={(e) => setValor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void confirmar();
                }
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void confirmar()} disabled={somar.isPending}>
            Somar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
