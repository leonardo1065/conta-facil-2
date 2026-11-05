import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarClock, Check, CheckCircle2, ChevronLeft, ChevronRight, Eye, EyeOff, HeartPulse, List, Pencil, Plus, Repeat, Search, Sun, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntryList } from "@/components/EntryList";
import { EntryDialog } from "@/components/EntryDialog";
import { HealthDialog } from "@/components/HealthDialog";
import { sum } from "@/lib/dueBuckets";
import { addMonths, currentMonthRef, formatBRL, formatDate, formatMonth, parseISO, todayISO } from "@/lib/dates";
import { useCategories, useEntries, type Entry } from "@/lib/finance";
import { HEALTH_KIND_LABEL, useHealthEvents, useToggleHealthDone, type HealthEvent } from "@/lib/health";
import { monthlyEntries, monthlyHealth, panelEntries, type PanelView } from "@/lib/monthly-panel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({ meta: [
    { title: "Gestão mensal — Agenda de Contas" },
    { name: "description", content: "Contas, pagamentos, recorrências e saúde organizados por mês, categoria e situação." },
    { property: "og:title", content: "Gestão mensal — Agenda de Contas" },
    { property: "og:description", content: "Contas, pagamentos, recorrências e saúde organizados por mês, categoria e situação." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Painel,
});

const views = [
  { value: "todos", label: "Contas do mês", icon: List },
  { value: "receitas", label: "Receitas do mês", icon: TrendingUp },
  { value: "recorrentes", label: "Recorrentes", icon: Repeat },
  { value: "pendentes", label: "Pendentes", icon: CalendarClock },
  { value: "hoje", label: "Vence hoje", icon: Sun },
  { value: "pagos", label: "Pagos", icon: CheckCircle2 },
  { value: "vencidos", label: "Vencidos", icon: AlertTriangle },
  { value: "saude", label: "Saúde", icon: HeartPulse },
] satisfies { value: PanelView; label: string; icon: typeof List }[];

function Painel() {
  const { data: entries = [], isLoading, error } = useEntries();
  const { data: categories = [] } = useCategories();
  const { data: events = [], isLoading: healthLoading, error: healthError } = useHealthEvents();
  const toggleHealth = useToggleHealthDone();
  const [month, setMonth] = useState(currentMonthRef);
  const [category, setCategory] = useState("todas");
  const [view, setView] = useState<PanelView>("todos");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [healthDialog, setHealthDialog] = useState(false);
  const [editingHealth, setEditingHealth] = useState<HealthEvent | null>(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try { setHidden(window.localStorage.getItem("ocultar-valores") === "1"); } catch { /* storage unavailable */ }
  }, []);
  const toggleHidden = () => {
    setHidden((previous) => {
      const next = !previous;
      try { window.localStorage.setItem("ocultar-valores", next ? "1" : "0"); } catch { /* storage unavailable */ }
      return next;
    });
  };
  const money = (value: number) => hidden ? "•••••" : formatBRL(value);
  const today = todayISO();
  const monthLabel = formatMonth(parseISO(`${month}-01`));
  const months = useMemo(() => {
    const values = new Set([month, currentMonthRef()]);
    for (let offset = -12; offset <= 24; offset++) values.add(addMonths(`${currentMonthRef()}-01`, offset).slice(0, 7));
    entries.forEach((entry) => values.add(entry.due_date.slice(0, 7)));
    events.forEach((event) => values.add(event.scheduled_date.slice(0, 7)));
    return [...values].sort();
  }, [entries, events, month]);
  const monthEntries = monthlyEntries(entries, month, category);
  const monthEvents = monthlyHealth(events, month);
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const list = panelEntries(monthEntries, view, today).filter((entry) => !query || entry.description.toLocaleLowerCase("pt-BR").includes(query) || categories.find((item) => item.id === entry.category_id)?.name.toLocaleLowerCase("pt-BR").includes(query));
  const healthList = monthEvents.filter((event) => !query || `${event.title} ${event.place_name ?? ""} ${HEALTH_KIND_LABEL[event.kind]}`.toLocaleLowerCase("pt-BR").includes(query));
  const pending = monthEntries.filter((entry) => entry.kind === "despesa" && !entry.is_avulsa && entry.status === "pendente");
  const paid = monthEntries.filter((entry) => entry.kind === "despesa" && entry.status === "pago");
  const income = panelEntries(monthEntries, "receitas", today);
  const daily = monthEntries.filter((entry) => entry.kind === "despesa" && entry.is_avulsa);
  const balance = sum(income) - (sum(paid) + sum(daily));
  const summaries = [
    { label: "A pagar", amount: sum(pending), icon: TrendingDown },
    { label: "Pago", amount: sum(paid), icon: CheckCircle2 },
    { label: "Diárias / avulsas", amount: sum(daily), icon: Wallet },
    { label: "Receitas do mês", amount: sum(income), icon: TrendingUp },
    { label: "Saldo final", amount: balance, icon: Wallet },
  ];

  return (
    <div className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Gestão de contas</h1>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="ghost" size="icon" aria-label={hidden ? "Mostrar valores" : "Ocultar valores"} title={hidden ? "Mostrar valores" : "Ocultar valores"} onClick={toggleHidden}>{hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button>
          <Button onClick={() => { if (view === "saude") { setEditingHealth(null); setHealthDialog(true); } else { setEditing(null); setDialog(true); } }}><Plus className="size-4" />{view === "saude" ? "Novo agendamento" : "Nova conta"}</Button>
        </div>
      </header>

      <section aria-label="Filtros do painel" className="space-y-4 border-y border-border py-4">
        <div className="grid min-w-0 gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" id="month-label">Mês de referência</label>
            <div className="flex min-w-0 items-center gap-1">
              <Button variant="outline" size="icon" className="shrink-0" title="Mês anterior" aria-label="Mês anterior" onClick={() => setMonth(addMonths(`${month}-01`, -1).slice(0, 7))}><ChevronLeft className="size-4" /></Button>
              <Select value={month} onValueChange={setMonth}><SelectTrigger aria-labelledby="month-label" className="min-w-0 flex-1"><SelectValue /></SelectTrigger><SelectContent>{months.map((value) => <SelectItem key={value} value={value}>{formatMonth(parseISO(`${value}-01`))}</SelectItem>)}</SelectContent></Select>
              <Button variant="outline" size="icon" className="shrink-0" title="Próximo mês" aria-label="Próximo mês" onClick={() => setMonth(addMonths(`${month}-01`, 1).slice(0, 7))}><ChevronRight className="size-4" /></Button>
              {month !== currentMonthRef() && <Button variant="ghost" size="sm" onClick={() => setMonth(currentMonthRef())}>Atual</Button>}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" id="category-label">Categoria</label>
            <Select value={category} onValueChange={setCategory} disabled={view === "saude"}><SelectTrigger aria-labelledby="category-label"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as categorias</SelectItem><SelectItem value="sem">Sem categoria</SelectItem>{categories.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
          </div>
        </div>
        <nav aria-label="Situação das contas" className="flex flex-wrap gap-2">
          {views.map((item) => {
            const count = item.value === "saude" ? monthEvents.length : panelEntries(monthEntries, item.value, today).length;
            return <Button key={item.value} size="sm" variant={view === item.value ? "default" : "outline"} aria-pressed={view === item.value} onClick={() => setView(item.value)}><item.icon className="size-3.5" />{item.label}<span className="tabular-nums opacity-75">{count}</span></Button>;
          })}
        </nav>
      </section>

      <section aria-label="Totais do mês" className="grid grid-cols-2 gap-x-4 gap-y-4 border-b border-border pb-5 sm:grid-cols-3 xl:grid-cols-5">
        {summaries.map((item) => <div key={item.label} className="min-w-0"><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><item.icon className="size-3.5 shrink-0" />{item.label}</p><p className={cn("mt-1 break-words text-lg font-semibold tabular-nums", item.label === "Saldo final" && "text-primary")}>{money(item.amount)}</p></div>)}
      </section>

      <section className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold">{views.find((item) => item.value === view)?.label} · {monthLabel}</h2><span className="text-xs text-muted-foreground">{view === "saude" ? healthList.length : list.length} registro(s)</span></div>
        <div className="relative print:hidden"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar contas ou saúde" className="pl-9" placeholder={view === "saude" ? "Buscar agendamento" : "Buscar conta ou categoria"} value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        {view === "saude" ? healthLoading ? <p className="text-sm text-muted-foreground">Carregando saúde...</p> : healthError ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar os agendamentos.</p> : healthList.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhum agendamento neste mês para esta busca.</p> : <ul className="divide-y divide-border">{healthList.map((event) => <li key={event.id} className="flex flex-wrap items-center gap-3 py-3"><HeartPulse className="size-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="break-words font-medium">{event.title}</p><p className="text-xs text-muted-foreground">{HEALTH_KIND_LABEL[event.kind]} · {formatDate(event.scheduled_date)}{event.scheduled_time ? ` às ${event.scheduled_time.slice(0, 5)}` : ""}{event.place_name ? ` · ${event.place_name}` : ""}</p><p className={cn("text-xs font-medium", event.done ? "text-success" : event.scheduled_date < today ? "text-destructive" : "text-muted-foreground")}>{event.done ? "Concluído" : event.scheduled_date === today ? "Hoje" : event.scheduled_date < today ? "Atrasado" : "Agendado"}</p></div><Button variant="ghost" size="icon" disabled={toggleHealth.isPending} aria-label={event.done ? "Reabrir agendamento" : "Concluir agendamento"} title={event.done ? "Reabrir agendamento" : "Concluir agendamento"} onClick={() => toggleHealth.mutate({ event, done: !event.done }, { onSuccess: () => toast.success("Agendamento atualizado."), onError: () => toast.error("Não foi possível atualizar o agendamento.") })}><Check className="size-4" /></Button><Button variant="ghost" size="icon" aria-label="Editar agendamento" title="Editar agendamento" onClick={() => { setEditingHealth(event); setHealthDialog(true); }}><Pencil className="size-4" /></Button></li>)}</ul> : isLoading ? <p className="text-sm text-muted-foreground">Carregando contas...</p> : error ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar suas contas.</p> : <EntryList entries={list} hideValues={hidden} empty="Nenhuma conta neste mês para os filtros selecionados." onEdit={(entry) => { setEditing(entry); setDialog(true); }} />}
        {view === "saude" && <Button variant="link" asChild><Link to="/saude">Abrir agenda de saúde</Link></Button>}
        {view !== "saude" && daily.length > 0 && <Button variant="link" asChild><Link to="/diarias">Diárias e avulsas · {money(sum(daily))}</Link></Button>}
      </section>
      <EntryDialog open={dialog} onOpenChange={setDialog} entry={editing} />
      <HealthDialog open={healthDialog} onOpenChange={setHealthDialog} event={editingHealth} />
    </div>
  );
}
