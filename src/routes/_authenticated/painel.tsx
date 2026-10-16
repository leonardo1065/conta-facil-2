import { useMemo, useState, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarClock,
  Plus,
  Settings,
  Search,
  Printer,
  Sun,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { EntryList } from "@/components/EntryList";
import { EntryDialog } from "@/components/EntryDialog";
import { NowCard } from "@/components/NowCard";
import { DueAlertBanner } from "@/components/DueAlertBanner";

import { SettingsDialog } from "@/components/SettingsDialog";
import { getDueBuckets, sum } from "@/lib/dueBuckets";
import { formatBRL, formatMonth, monthRange, todayISO } from "@/lib/dates";
import { useCategories, useEntries, type Entry } from "@/lib/finance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — Agenda de Contas" },
      { name: "description", content: "Vencimentos em destaque, totais do mês e gastos por categoria." },
      { property: "og:title", content: "Painel — Agenda de Contas" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:description", content: "Vencimentos em destaque, totais do mês e gastos por categoria." },
    ],
  }),
  component: Painel,
});

function Painel() {
  const { data: entries, isLoading } = useEntries();
  const { data: categories } = useCategories();
  const [dialogo, setDialogo] = useState(false);
  const [config, setConfig] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Entry | null>(null);
  const [busca, setBusca] = useState("");

  const buckets = getDueBuckets(entries);
  // Mês corrente pelo fuso America/Sao_Paulo (GMT-3), não pelo fuso do navegador.
  const [anoHoje, mesHoje] = todayISO().split("-").map(Number);
  const { start, end } = monthRange(anoHoje, mesHoje - 1);

  const doMes = useMemo(
    () => (entries ?? []).filter((e) => e.due_date >= start && e.due_date <= end),
    [entries, start, end],
  );

  const aPagar = doMes.filter((e) => e.kind === "despesa" && e.status === "pendente");
  const pago = doMes.filter((e) => e.kind === "despesa" && e.status === "pago");
  const receitas = doMes.filter((e) => e.kind === "receita");
  const saldo = sum(receitas) - sum(aPagar) - sum(pago);

  const porCategoria = useMemo(() => {
    const mapa = new Map<string, { name: string; color: string; value: number }>();
    for (const e of doMes.filter((x) => x.kind === "despesa")) {
      const cat = categories?.find((c) => c.id === e.category_id);
      const key = cat?.id ?? "sem";
      const atual = mapa.get(key) ?? {
        name: cat?.name ?? "Sem categoria",
        color: cat?.color ?? "#94a3b8",
        value: 0,
      };
      atual.value += e.amount;
      mapa.set(key, atual);
    }
    return [...mapa.values()].sort((a, b) => b.value - a.value);
  }, [doMes, categories]);

  const alerta = [
    {
      titulo: "Vencidas",
      icon: AlertTriangle,
      itens: buckets.vencidas,
      classe: "border-destructive/40 bg-destructive/10 text-destructive",
    },
    {
      titulo: "Vence hoje",
      icon: Sun,
      itens: buckets.hoje,
      classe: "border-warning/50 bg-warning/15 text-warning",
    },
    {
      titulo: "Próximos 7 dias",
      icon: CalendarClock,
      itens: buckets.proximos,
      classe: "border-info/40 bg-info/10 text-info",
    },
  ];

  const destaque = [...buckets.vencidas, ...buckets.hoje, ...buckets.proximos];

  const destaqueFiltrado = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return destaque;
    return destaque.filter((e) => {
      const cat = categories?.find((c) => c.id === e.category_id);
      return (
        e.description.toLowerCase().includes(termo) ||
        (cat?.name ?? "").toLowerCase().includes(termo)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, categories, entries]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm font-medium capitalize text-muted-foreground">{formatMonth(new Date(anoHoje, mesHoje - 1, 1))}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            className="gap-2"
            onClick={() => {
              setEmEdicao(null);
              setDialogo(true);
            }}
          >
            <Plus className="size-4" /> Novo
          </Button>
        </div>
      </div>


      <section className="grid gap-3 sm:grid-cols-3">

        {alerta.map((bloco) => (
          <div key={bloco.titulo} className={cn("rounded-2xl border p-4", bloco.classe)}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <bloco.icon className="size-4" />
              {bloco.titulo}
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{bloco.itens.length}</p>
            <p className="text-sm font-medium opacity-90">{formatBRL(sum(bloco.itens))}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <Resumo titulo="A pagar" valor={sum(aPagar)} icon={TrendingDown} />
        <Resumo titulo="Pago" valor={sum(pago)} icon={Wallet} />
        <Resumo titulo="Receitas" valor={sum(receitas)} icon={TrendingUp} />
        <Resumo titulo="Saldo" valor={saldo} icon={Wallet} destaque />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Atenção agora</h2>
          </div>
          <div className="relative print:hidden">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por descrição ou categoria"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <EntryList
              entries={destaqueFiltrado}
              empty={
                busca.trim()
                  ? "Nenhuma conta encontrada para esta busca."
                  : "Tudo em dia por aqui. Nenhuma conta vencendo nos próximos 7 dias."
              }
              onEdit={(e) => {
                setEmEdicao(e);
                setDialogo(true);
              }}
            />
          )}
        </div>

        <div className="card-elevated p-5">
          <h2 className="text-lg font-semibold">Despesas por categoria</h2>
          {porCategoria.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Sem despesas neste mês.</p>
          ) : (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={porCategoria} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                      {porCategoria.map((c) => (
                        <Cell key={c.name} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatBRL(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {porCategoria.slice(0, 6).map((c) => (
                  <li key={c.name} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="tabular-nums text-muted-foreground">{formatBRL(c.value)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <EntryDialog open={dialogo} onOpenChange={setDialogo} entry={emEdicao} />
      <SettingsDialog open={config} onOpenChange={setConfig} />
    </div>
  );
}

function Resumo({
  titulo,
  valor,
  icon: Icon,
  destaque,
}: {
  titulo: string;
  valor: number;
  icon: typeof Wallet;
  destaque?: boolean;
}) {
  return (
    <div className={cn("card-elevated p-4", destaque && "bg-brand text-primary-foreground")}>
      <div className="flex items-center gap-2 text-sm opacity-80">
        <Icon className="size-4" />
        {titulo}
      </div>
      <p className="mt-1 text-xl font-bold tabular-nums">{formatBRL(valor)}</p>
    </div>
  );
}
