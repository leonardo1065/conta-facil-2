import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, ShoppingBasket, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AvulsaAddDialog } from "@/components/AvulsaAddDialog";
import {
  currentMonthRef,
  formatBRL,
  lastDayOfMonth,
  formatMonth,
  todayISO,
} from "@/lib/dates";
import {
  useAddToAvulsa,
  useEntries,
  useSaveEntry,
  type Entry,
} from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/diarias")({
  head: () => ({
    meta: [
      { title: "Contas diárias e avulsas — Agenda de Contas" },
      {
        name: "description",
        content:
          "Some gastos do dia a dia como padaria, mercado, farmácia e almoço. O total acumula no mês e zera no dia 1º.",
      },
      { property: "og:title", content: "Contas diárias e avulsas — Agenda de Contas" },
      {
        property: "og:description",
        content: "Gastos diários somados no mês, com reinício automático todo dia 1º.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Diarias,
});

const SUGESTOES = ["Padaria", "Mercado", "Farmácia", "Almoço", "Combustível", "Lanche"];
const ATALHOS = [5, 10, 20, 50, 100];

function Diarias() {
  const { data: entries, isLoading } = useEntries();
  const salvar = useSaveEntry();
  const somar = useAddToAvulsa();
  const [novo, setNovo] = useState(false);
  const [nome, setNome] = useState("");
  const [emSoma, setEmSoma] = useState<Entry | null>(null);

  const ref = currentMonthRef();

  // Uma linha por série: a do mês corrente quando existir.
  const contas = useMemo(() => {
    const avulsas = (entries ?? []).filter((e) => e.is_avulsa);
    const porSerie = new Map<string, Entry>();
    for (const e of avulsas) {
      const key = e.series_id ?? e.id;
      const atual = porSerie.get(key);
      if (!atual) porSerie.set(key, e);
      else if (e.month_ref === ref) porSerie.set(key, e);
      else if (atual.month_ref !== ref && (e.month_ref ?? "") > (atual.month_ref ?? ""))
        porSerie.set(key, e);
    }
    return [...porSerie.values()].sort((a, b) => a.description.localeCompare(b.description));
  }, [entries, ref]);

  const totalMes = contas.reduce(
    (acc, e) => acc + (e.month_ref === ref ? Number(e.amount) : 0),
    0,
  );

  // Histórico: todos os meses já registrados (inclusive o atual), com detalhe por gasto.
  const historico = useMemo(() => {
    const meses = new Map<string, { total: number; itens: { nome: string; valor: number }[] }>();
    for (const e of entries ?? []) {
      if (!e.is_avulsa) continue;
      const mes = e.month_ref ?? e.due_date.slice(0, 7);
      const atual = meses.get(mes) ?? { total: 0, itens: [] };
      atual.total += Number(e.amount);
      atual.itens.push({ nome: e.description, valor: Number(e.amount) });
      meses.set(mes, atual);
    }
    return [...meses.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([mes, dados]) => ({
        mes,
        total: dados.total,
        itens: dados.itens.sort((a, b) => b.valor - a.valor),
      }));
  }, [entries]);

  const [mesAberto, setMesAberto] = useState<string | null>(null);


  async function criar(desc: string) {
    const descricao = desc.trim();
    if (!descricao) {
      toast.error("Informe o nome do gasto diário.");
      return;
    }
    try {
      await salvar.mutateAsync({
        values: {
          description: descricao,
          amount: 0,
          due_date: lastDayOfMonth(todayISO()),
          category_id: null,
          kind: "despesa",
          status: "pendente",
          paid_at: null,
          notes: null,
          attachment_path: null,
          barcode: null,
          series_id: null,
          recurrence: {
            mode: "avulsa",
            frequency: "mensal",
            interval: 1,
            count: 1,
            intervalMonths: 1,
            unit: "mes",
          },
        },
      });
      toast.success(`"${descricao}" criada como conta diária.`);
      setNome("");
      setNovo(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar conta diária.");
    }
  }

  async function somarRapido(entry: Entry, valor: number) {
    try {
      const res = await somar.mutateAsync({ entry, valor });
      toast.success(
        res?.novoMes
          ? `Novo mês iniciado em ${entry.description}: ${formatBRL(valor)}`
          : `+${formatBRL(valor)} em ${entry.description}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao somar valor.");
    }
  }

  const existentes = new Set(contas.map((c) => c.description.toLowerCase()));
  const faltando = SUGESTOES.filter((s) => !existentes.has(s.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Contas diárias e avulsas</h1>
          <p className="text-sm text-muted-foreground">
            Gastos do dia a dia que não são fixos. Cada lançamento soma ao total do mês e
            recomeça do zero no dia 1º.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 print:hidden" onClick={() => window.print()}>
            <Printer className="size-4" /> Imprimir Diárias
          </Button>
          <Button className="gap-2 print:hidden" onClick={() => setNovo(true)}>
            <Plus className="size-4" /> Nova conta diária
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <p className="text-sm text-muted-foreground">Total gasto em {formatMonth(new Date())}</p>
        <p className="text-3xl font-bold">{formatBRL(totalMes)}</p>
      </div>

      {faltando.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Criar rápido:</span>
          {faltando.map((s) => (
            <Button
              key={s}
              size="sm"
              variant="outline"
              disabled={salvar.isPending}
              onClick={() => void criar(s)}
            >
              + {s}
            </Button>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : contas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <ShoppingBasket className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhuma conta diária ainda. Crie uma acima (padaria, mercado, farmácia, almoço...).
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-1 print:gap-1">
          {contas.map((c) => {
            const acumulado = c.month_ref === ref ? Number(c.amount) : 0;
            return (
              <div
                key={c.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft print:border-none print:shadow-none print:border-b print:border-black print:rounded-none print:px-0 print:py-1 print:text-black"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{c.description}</p>
                    <p className="text-2xl font-bold">{formatBRL(acumulado)}</p>
                    <p className="text-xs text-muted-foreground print:hidden">acumulado no mês</p>
                  </div>
                  <div className="hidden print:block text-right">
                    <p className="text-sm font-medium">{formatMonth(new Date())}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 print:hidden">
                  {ATALHOS.map((v) => (
                    <Button
                      key={v}
                      size="sm"
                      variant="secondary"
                      disabled={somar.isPending}
                      onClick={() => void somarRapido(c, v)}
                    >
                      +{v}
                    </Button>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => setEmSoma(c)}>
                    Outro valor
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={novo} onOpenChange={setNovo}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova conta diária</DialogTitle>
            <DialogDescription>
              Ex.: Padaria, Mercado, Farmácia, Almoço. Os valores lançados somam durante o mês.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="nome-diaria">Nome</Label>
            <Input
              id="nome-diaria"
              autoFocus
              value={nome}
              placeholder="Padaria"
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void criar(nome);
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNovo(false)}>
              Cancelar
            </Button>
            <Button disabled={salvar.isPending} onClick={() => void criar(nome)}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AvulsaAddDialog entry={emSoma} onClose={() => setEmSoma(null)} />
    </div>
  );
}
