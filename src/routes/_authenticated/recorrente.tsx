import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Repeat, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateField } from "@/components/DateField";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntryList } from "@/components/EntryList";
import { currentMonthRef, monthRef, todayISO } from "@/lib/dates";
import {
  useCategories,
  useEntries,
  useSaveEntry,
  type Entry,
  type EntryKind,
  type EntryStatus,
  type Recurrence,
} from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/recorrente")({
  head: () => ({
    meta: [
      { title: "Contas Recorrentes — Agenda de Contas" },
      { name: "description", content: "Cadastre contas que se repetem: mensal, quinzenal, semanal, diária ou em prestações." },
      { property: "og:title", content: "Contas Recorrentes — Agenda de Contas" },
      { property: "og:description", content: "Cadastre contas que se repetem: mensal, quinzenal, semanal, diária ou em prestações." },
    ],
  }),
  component: Recorrente,
});

type Repeticao = "mensal" | "quinzenal" | "semanal" | "diaria" | "prestacoes";

const emptyForm = () => ({
  description: "",
  amount: "",
  due_date: todayISO(),
  category_id: "",
  kind: "despesa" as EntryKind,
  status: "pendente" as EntryStatus,
  notes: "",
});

function Recorrente() {
  const { data: entries, isLoading } = useEntries();
  const { data: categories } = useCategories();
  const salvar = useSaveEntry();

  const [emEdicao, setEmEdicao] = useState<Entry | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [repeticao, setRepeticao] = useState<Repeticao>("mensal");
  const [parcelas, setParcelas] = useState(6);
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!emEdicao) return;
    setForm({
      description: emEdicao.description,
      amount: String(emEdicao.amount),
      due_date: emEdicao.due_date,
      category_id: emEdicao.category_id ?? "",
      kind: emEdicao.kind,
      status: emEdicao.status,
      notes: emEdicao.notes ?? "",
    });
  }, [emEdicao]);

  function editar(entry: Entry) {
    setEmEdicao(entry);
    // Garante que o formulário fique visível (principalmente no celular)
    requestAnimationFrame(() =>
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  const lista = useMemo(() => {
    const refAtual = currentMonthRef();
    return (entries ?? []).filter(
      (e) =>
        (e.is_recurring || (e.installment_total ?? 0) > 1) &&
        monthRef(e.due_date) === refAtual,
    );
  }, [entries]);

  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return lista.filter((e) => {
      const porCategoria = filtroCategoria === "todas" || e.category_id === filtroCategoria;
      const porStatus = filtroStatus === "todos" || e.status === filtroStatus;
      const porBusca = termo === "" || e.description.toLowerCase().includes(termo);
      return porCategoria && porStatus && porBusca;
    });
  }, [lista, filtroCategoria, filtroStatus, busca]);

  const categoriasFiltradas = (categories ?? []).filter((c) => c.kind === form.kind);

  function recorrenciaDaSelecao(): Recurrence {
    switch (repeticao) {
      case "quinzenal":
        return { mode: "recorrente", frequency: "mensal", interval: 15, count: 1, intervalMonths: 2, unit: "semana" };
      case "semanal":
        return { mode: "recorrente", frequency: "mensal", interval: 7, count: 1, intervalMonths: 1, unit: "semana" };
      case "diaria":
        return { mode: "recorrente", frequency: "mensal", interval: 1, count: 1, intervalMonths: 1, unit: "dia" };
      case "prestacoes":
        return { mode: "parcelada", frequency: "mensal", interval: 30, count: parcelas, intervalMonths: 1, unit: "mes" };
      default:
        return { mode: "recorrente", frequency: "mensal", interval: 30, count: 1, intervalMonths: 1, unit: "mes" };
    }
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    const valor = Number(String(form.amount).replace(",", "."));
    if (!form.description.trim()) return toast.error("Informe a descrição.");
    if (!Number.isFinite(valor) || valor < 0) return toast.error("Informe um valor válido.");
    if (repeticao === "prestacoes" && (!Number.isFinite(parcelas) || parcelas < 1))
      return toast.error("Informe o número de prestações.");

    try {
      await salvar.mutateAsync({
        id: emEdicao?.id,
        values: {
          description: form.description.trim(),
          amount: valor,
          due_date: form.due_date,
          category_id: form.category_id || null,
          kind: form.kind,
          status: form.status,
          paid_at: form.status === "pago" ? (emEdicao?.paid_at ?? todayISO()) : null,
          notes: form.notes.trim() || null,
          attachment_path: emEdicao?.attachment_path ?? null,
          barcode: emEdicao?.barcode ?? null,
          series_id: emEdicao?.series_id ?? null,
          recurrence: recorrenciaDaSelecao(),
        },
      });
      toast.success(emEdicao ? "Conta atualizada." : "Conta recorrente cadastrada.");
      setEmEdicao(null);
      setForm(emptyForm());
      setRepeticao("mensal");
      setParcelas(6);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Repeat className="size-6 text-brand" />
        <h1 className="text-2xl font-bold">Contas Recorrentes</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cadastro */}
        <form ref={formRef} onSubmit={submeter} className="card-elevated h-fit space-y-4 p-4 sm:p-5">
          <h2 className="font-semibold">{emEdicao ? "Alterar conta" : "Cadastrar conta"}</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => setForm({ ...form, kind: v as EntryKind, category_id: "" })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="receita">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Situação</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as EntryStatus })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">{form.kind === "receita" ? "Recebido" : "Pago"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rec-descricao">Descrição</Label>
            <Input
              id="rec-descricao"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Assinatura de internet"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="rec-valor">Valor (R$)</Label>
              <Input
                id="rec-valor"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rec-data">Vencimento</Label>
              <DateField
                id="rec-data"
                value={form.due_date}
                onChange={(iso) => setForm({ ...form, due_date: iso })}
              />
            </div>
          </div>

          {!emEdicao && (
            <div className="space-y-3 rounded-2xl border border-border/70 p-3">
              <div className="space-y-2">
                <Label>Repetição</Label>
                <Select value={repeticao} onValueChange={(v) => setRepeticao(v as Repeticao)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="quinzenal">Quinzenal</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="diaria">Diária</SelectItem>
                    <SelectItem value="prestacoes">Prestações</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {repeticao === "prestacoes" && (
                <div className="space-y-2">
                  <Label htmlFor="rec-parcelas">Quantas prestações?</Label>
                  <Input
                    id="rec-parcelas"
                    type="number"
                    min={1}
                    max={120}
                    value={parcelas}
                    onChange={(e) => setParcelas(Number(e.target.value))}
                  />
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {repeticao === "prestacoes"
                  ? "Todas as prestações são criadas de uma vez com o mesmo valor."
                  : "Ao marcar como paga, a próxima conta do período é criada automaticamente."}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select
              value={form.category_id}
              onValueChange={(v) => setForm({ ...form, category_id: v })}
            >
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {categoriasFiltradas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rec-obs">Observações</Label>
            <Textarea
              id="rec-obs"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className="flex gap-2">
            {emEdicao && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEmEdicao(null);
                  setForm(emptyForm());
                }}
              >
                Cancelar edição
              </Button>
            )}
            <Button type="submit" className="ml-auto" disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando..." : emEdicao ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </div>
        </form>

        {/* Lista */}
        <div className="space-y-3">
          <h2 className="font-semibold">Contas do mês atual</h2>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar conta pelo nome..."
              className="pl-9"
              aria-label="Buscar conta pelo nome"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {(categories ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Situação</Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago / Recebido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <EntryList
              entries={listaFiltrada}
              onEdit={editar}
              empty="Nenhuma conta recorrente encontrada neste mês com os filtros selecionados."
            />
          )}
        </div>
      </div>
    </div>
  );
}
