import { useEffect, useState } from "react";
import { Paperclip, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/DateField";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScannerDialog } from "./ScannerDialog";
import { todayISO } from "@/lib/dates";
import { useCategories, useSaveEntry, type Entry, type EntryKind, type EntryStatus, type Recurrence } from "@/lib/finance";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: Entry | null;
  defaultDate?: string;
};

const emptyForm = (date: string) => ({
  description: "",
  amount: "",
  due_date: date,
  category_id: "",
  kind: "despesa" as EntryKind,
  status: "pendente" as EntryStatus,
  paid_at: "",
  notes: "",
  barcode: "",
});

export function EntryDialog({ open, onOpenChange, entry, defaultDate }: Props) {
  const { data: categories } = useCategories();
  const salvar = useSaveEntry();
  const [form, setForm] = useState(emptyForm(defaultDate ?? todayISO()));
  const [recorrencia, setRecorrencia] = useState<Recurrence>({
    mode: "nenhuma",
    frequency: "mensal",
    interval: 30,
    count: 6,
    intervalMonths: 1,
    unit: "mes",
  });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [scanner, setScanner] = useState(false);

  useEffect(() => {
    if (!open) return;
    setArquivo(null);
    setRecorrencia({
      mode: "nenhuma",
      frequency: "mensal",
      interval: 30,
      count: 6,
      intervalMonths: 1,
      unit: "mes",
    });

    if (entry) {
      setForm({
        description: entry.description,
        amount: String(entry.amount),
        due_date: entry.due_date,
        category_id: entry.category_id ?? "",
        kind: entry.kind,
        status: entry.status,
        paid_at: entry.paid_at ?? "",
        notes: entry.notes ?? "",
        barcode: entry.barcode ?? "",
      });
    } else {
      setForm(emptyForm(defaultDate ?? todayISO()));
    }
  }, [open, entry, defaultDate]);

  const categoriasFiltradas = (categories ?? []).filter((c) => c.kind === form.kind);

  async function enviarAnexo(): Promise<string | null> {
    if (!arquivo) return entry?.attachment_path ?? null;
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) return null;
    const path = `${uid}/${crypto.randomUUID()}-${arquivo.name.replace(/\s+/g, "-")}`;
    const { error } = await supabase.storage.from("anexos").upload(path, arquivo);
    if (error) {
      toast.error("Não foi possível enviar o anexo.");
      return entry?.attachment_path ?? null;
    }
    return path;
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    const valor = Number(form.amount.replace(",", "."));
    if (!form.description.trim()) return toast.error("Informe a descrição.");
    if (!Number.isFinite(valor) || valor < 0) return toast.error("Informe um valor válido.");

    const attachment_path = await enviarAnexo();

    try {
      await salvar.mutateAsync({
        id: entry?.id,
        values: {
          description: form.description.trim(),
          amount: valor,
          due_date: form.due_date,
          category_id: form.category_id || null,
          kind: form.kind,
          status: form.status,
          paid_at: form.status === "pago" ? form.paid_at || todayISO() : null,
          notes: form.notes.trim() || null,
          attachment_path,
          barcode: form.barcode || null,
          series_id: entry?.series_id ?? null,
          recurrence: recorrencia,
        },
      });
      toast.success(entry ? "Lançamento atualizado." : "Lançamento criado.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{entry ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={submeter} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={form.kind}
                  onValueChange={(v) => setForm({ ...form, kind: v as EntryKind, category_id: "" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="despesa">Despesa</SelectItem>
                    <SelectItem value="receita">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as EntryStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">
                      {form.kind === "receita" ? "Recebido" : "Pago"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Input
                id="descricao"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Conta de luz de julho"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="valor">Valor (R$)</Label>
                <Input
                  id="valor"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vencimento">Vencimento</Label>
                <DateField
                  id="vencimento"
                  value={form.due_date}
                  onChange={(iso) => setForm({ ...form, due_date: iso })}
                />
              </div>
            </div>

            {form.status === "pago" && (
              <div className="space-y-2">
                <Label htmlFor="pagamento">
                  {form.kind === "receita" ? "Data do recebimento" : "Data do pagamento"}
                </Label>
                <DateField
                  id="pagamento"
                  value={form.paid_at || todayISO()}
                  onChange={(iso) => setForm({ ...form, paid_at: iso })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={form.category_id}
                onValueChange={(v) => setForm({ ...form, category_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {categoriasFiltradas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!entry &&
              categoriasFiltradas
                .find((c) => c.id === form.category_id)
                ?.name.toLowerCase()
                .normalize("NFD")
                .replace(/[̀-ͯ]/g, "")
                // eslint-disable-line
                .includes("saude") && (
                <label className="flex items-center gap-2 rounded-2xl border border-border/70 p-3 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={recorrencia.mode === "recorrente" && recorrencia.unit === "mes"}
                    onChange={(e) =>
                      setRecorrencia(
                        e.target.checked
                          ? { ...recorrencia, mode: "recorrente", unit: "mes", intervalMonths: 1 }
                          : { ...recorrencia, mode: "nenhuma" }
                      )
                    }
                  />
                  Repetir todo mês (retorno mensal)
                </label>
              )}

            {!entry && (
              <div className="space-y-3 rounded-2xl border border-border/70 p-3">
                <div className="space-y-2">
                  <Label>Repetição</Label>
                  <Select
                    value={
                      recorrencia.mode === "recorrente" && recorrencia.unit === "semana"
                        ? "semanal"
                        : recorrencia.mode
                    }
                    onValueChange={(v) => {
                      if (v === "semanal") {
                        setRecorrencia({
                          ...recorrencia,
                          mode: "recorrente",
                          unit: "semana",
                          intervalMonths: 1,
                        });
                        return;
                      }
                      setRecorrencia({
                        ...recorrencia,
                        mode: v as Recurrence["mode"],
                        unit: "mes",
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhuma">Sem repetição</SelectItem>
                      <SelectItem value="recorrente">Conta fixa mensal (repete sozinha)</SelectItem>
                      <SelectItem value="semanal">Semanal (repete toda semana)</SelectItem>
                      <SelectItem value="parcelada">Parcelada (nº de parcelas)</SelectItem>
                      <SelectItem value="avulsa">Avulsa (soma no mês, zera no dia 1º)</SelectItem>
                    </SelectContent>
                  </Select>

                </div>

                {recorrencia.mode === "recorrente" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Periodicidade</Label>
                        <Select
                          value={recorrencia.unit}
                          onValueChange={(v) =>
                            setRecorrencia({ ...recorrencia, unit: v as Recurrence["unit"] })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mes">Mensal</SelectItem>
                            <SelectItem value="semana">Semanal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="meses">
                          Repetir a cada ({recorrencia.unit === "semana" ? "semanas" : "meses"})
                        </Label>
                        <Input
                          id="meses"
                          type="number"
                          min={1}
                          max={recorrencia.unit === "semana" ? 52 : 12}
                          value={recorrencia.intervalMonths}
                          onChange={(e) =>
                            setRecorrencia({ ...recorrencia, intervalMonths: Number(e.target.value) })
                          }
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Só esta conta aparece na lista. Ao marcar como paga, a próxima é criada
                      automaticamente com o valor zerado, pronta para você informar o valor do
                      período.
                    </p>
                  </>
                )}

                {recorrencia.mode === "avulsa" && (
                  <p className="text-xs text-muted-foreground">
                    Conta avulsa: use o botão “+” na lista para somar cada gasto ao total do mês.
                    No dia 1º do mês seguinte o lançamento recomeça do zero, mantendo o histórico
                    dos meses anteriores.
                  </p>
                )}

                {recorrencia.mode === "parcelada" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Frequência</Label>
                        <Select
                          value={recorrencia.frequency}
                          onValueChange={(v) =>
                            setRecorrencia({ ...recorrencia, frequency: v as Recurrence["frequency"] })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mensal">Mensal</SelectItem>
                            <SelectItem value="semanal">Semanal</SelectItem>
                            <SelectItem value="diaria">Diária</SelectItem>
                            <SelectItem value="personalizada">A cada X dias</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="parcelas">Nº de parcelas</Label>
                        <Input
                          id="parcelas"
                          type="number"
                          min={1}
                          max={120}
                          value={recorrencia.count}
                          onChange={(e) =>
                            setRecorrencia({ ...recorrencia, count: Number(e.target.value) })
                          }
                        />
                      </div>
                    </div>
                    {recorrencia.frequency === "personalizada" && (
                      <div className="space-y-2">
                        <Label htmlFor="intervalo">Intervalo (dias)</Label>
                        <Input
                          id="intervalo"
                          type="number"
                          min={1}
                          value={recorrencia.interval}
                          onChange={(e) =>
                            setRecorrencia({ ...recorrencia, interval: Number(e.target.value) })
                          }
                        />
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Todas as parcelas são criadas com o mesmo valor (ex.: 6 parcelas de R$ 500).
                    </p>
                  </>
                )}
              </div>
            )}


            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" className="gap-2" onClick={() => setScanner(true)}>
                <ScanLine className="size-4" /> Escanear boleto/Pix
              </Button>
              <Button type="button" variant="outline" className="gap-2" asChild>
                <label>
                  <Paperclip className="size-4" />
                  {arquivo ? arquivo.name.slice(0, 18) : "Anexo"}
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                  />
                </label>
              </Button>
            </div>

            {form.barcode && (
              <p className="truncate rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                Código: {form.barcode}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvar.isPending}>
                {salvar.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ScannerDialog
        open={scanner}
        onOpenChange={setScanner}
        onDetected={(res) => {
          setForm((prev) => ({
            ...prev,
            barcode: res.raw,
            amount: res.amount ? res.amount.toFixed(2).replace(".", ",") : prev.amount,
            due_date: res.dueDate ?? prev.due_date,
          }));
          toast.success(
            res.kind === "desconhecido"
              ? "Código salvo, mas não reconhecido."
              : res.dueDate
                ? "Valor e vencimento preenchidos pelo código."
                : "Valor preenchido; confira o vencimento.",
          );
        }}

      />
    </>
  );
}
