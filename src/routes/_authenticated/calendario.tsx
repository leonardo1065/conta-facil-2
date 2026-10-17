import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntryList } from "@/components/EntryList";
import { EntryDialog } from "@/components/EntryDialog";
import { addDays, addMonths, formatBRL, formatDate, formatMonth, monthRange, todayISO } from "@/lib/dates";
import { useEntries, type Entry } from "@/lib/finance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Calendário — Agenda de Contas" },
      { name: "description", content: "Veja as contas de cada dia do mês e quite direto pelo calendário." },
      { property: "og:title", content: "Calendário — Agenda de Contas" },
      { property: "og:description", content: "Veja as contas de cada dia do mês e quite direto pelo calendário." },
    ],
  }),
  component: Calendario,
});

const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];

function Calendario() {
  const { data: entries } = useEntries();
  const hoje = todayISO();
  // Mês inicial sempre pelo calendário de São Paulo (GMT-3), não pelo fuso do navegador.
  const [ref, setRef] = useState(() => {
    const [y, m] = hoje.split("-").map(Number);
    return { ano: y, mes: m - 1 };
  });
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(hoje);
  const [dialogo, setDialogo] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Entry | null>(null);

  const { start, end } = monthRange(ref.ano, ref.mes);
  const primeiroDiaSemana = new Date(ref.ano, ref.mes, 1).getDay();
  const totalDias = new Date(ref.ano, ref.mes + 1, 0).getDate();

  const porDia = useMemo(() => {
    const mapa = new Map<string, Entry[]>();
    for (const e of entries ?? []) {
      if (e.due_date < start || e.due_date > end) continue;
      mapa.set(e.due_date, [...(mapa.get(e.due_date) ?? []), e]);
    }
    return mapa;
  }, [entries, start, end]);

  // Contas fixas (semanais/mensais) existem como um único lançamento: projetamos
  // as próximas ocorrências para aparecerem nos dias de vencimento do mês.
  const previsoesPorDia = useMemo(() => {
    const mapa = new Map<string, Entry[]>();
    for (const e of entries ?? []) {
      if (!e.is_recurring) continue;
      const passo = Math.max(1, e.recurrence_interval_months || 1);
      let data = e.due_date;
      for (let i = 0; i < 60; i++) {
        data = e.recurrence_unit === "semana" ? addDays(data, passo * 7) : addMonths(data, passo);
        if (data > end) break;
        if (data < start) continue;
        if ((porDia.get(data) ?? []).some((x) => x.series_id && x.series_id === e.series_id)) continue;
        mapa.set(data, [...(mapa.get(data) ?? []), { ...e, due_date: data }]);
      }
    }
    return mapa;
  }, [entries, start, end, porDia]);

  const iso = (dia: number) =>
    `${ref.ano}-${String(ref.mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

  function mudarMes(delta: number) {
    const d = new Date(ref.ano, ref.mes + delta, 1);
    setRef({ ano: d.getFullYear(), mes: d.getMonth() });
    setDiaSelecionado(null);
  }

  const doDia = diaSelecionado ? (porDia.get(diaSelecionado) ?? []) : [];
  const previstasDoDia = diaSelecionado ? (previsoesPorDia.get(diaSelecionado) ?? []) : [];


  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Calendário</h1>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Mês anterior" onClick={() => mudarMes(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-40 text-center text-sm font-medium capitalize">
            {formatMonth(new Date(ref.ano, ref.mes, 1))}
          </span>
          <Button variant="outline" size="icon" aria-label="Próximo mês" onClick={() => mudarMes(1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="card-elevated p-3 sm:p-4">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
          {DIAS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: primeiroDiaSemana }).map((_, i) => (
            <span key={`v${i}`} />
          ))}
          {Array.from({ length: totalDias }, (_, i) => i + 1).map((dia) => {
            const data = iso(dia);
            const itens = porDia.get(data) ?? [];
            const previstas = previsoesPorDia.get(data) ?? [];
            const temVencida = itens.some(
              (e) => e.kind === "despesa" && e.status === "pendente" && data < hoje,
            );
            const temPendente = itens.some((e) => e.kind === "despesa" && e.status === "pendente");
            const cor = temVencida
              ? "bg-destructive"
              : data === hoje && temPendente
                ? "bg-warning"
                : temPendente
                  ? "bg-info"
                  : "bg-success";
            return (
              <button
                key={dia}
                type="button"
                onClick={() => setDiaSelecionado(data)}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center rounded-lg border text-sm transition-colors",
                  data === hoje ? "border-primary font-bold" : "border-transparent",
                  diaSelecionado === data ? "bg-accent" : "hover:bg-muted",
                )}
              >
                {dia}
                <span className="mt-1 flex items-center gap-0.5">
                  {itens.length > 0 && <span className={cn("size-1.5 rounded-full", cor)} />}
                  {previstas.length > 0 && (
                    <span
                      className={cn(
                        "size-1.5 rounded-full border border-info",
                        itens.length > 0 ? "bg-transparent" : "bg-transparent",
                      )}
                    />
                  )}
                </span>
              </button>
            );
          })}

        </div>
      </div>

      {diaSelecionado && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {formatDate(diaSelecionado)}
              {doDia.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {formatBRL(doDia.reduce((t, e) => t + e.amount, 0))}
                </span>
              )}
            </h2>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                setEmEdicao(null);
                setDialogo(true);
              }}
            >
              <Plus className="size-4" /> Adicionar
            </Button>
          </div>
          <EntryList
            entries={doDia}
            empty={previstasDoDia.length > 0 ? undefined : "Nenhuma conta neste dia."}
            onEdit={(e) => {
              setEmEdicao(e);
              setDialogo(true);
            }}
          />
          {previstasDoDia.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-dashed border-info/60 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Previsão (conta fixa {previstasDoDia[0].recurrence_unit === "semana" ? "semanal" : "mensal"})
              </p>
              {previstasDoDia.map((e) => (
                <div key={`${e.id}-${e.due_date}`} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{e.description}</span>
                  <span className="text-muted-foreground">
                    {e.amount > 0 ? formatBRL(e.amount) : "valor a informar"}
                  </span>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      <EntryDialog
        open={dialogo}
        onOpenChange={setDialogo}
        entry={emEdicao}
        defaultDate={diaSelecionado ?? undefined}
      />
    </div>
  );
}
