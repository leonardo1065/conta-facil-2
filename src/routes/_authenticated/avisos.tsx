import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  MessageCircle,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NowCard } from "@/components/NowCard";
import { logsAvisos, limparLogsAvisos } from "@/lib/avisos.functions";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/avisos")({
  head: () => ({
    meta: [
      { title: "Logs de avisos — Agenda de Contas" },
      {
        name: "description",
        content:
          "Histórico de envio dos avisos de contas e saúde por e-mail e WhatsApp: horário, destinatário, tipo, motivo da falha e tentativas.",
      },
      { property: "og:title", content: "Logs de avisos — Agenda de Contas" },
      {
        property: "og:description",
        content:
          "Acompanhe cada envio de aviso por e-mail e WhatsApp, com status, motivo da falha e número de tentativas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AvisosPage,
  errorComponent: ({ error }) => (
    <div role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
      Não foi possível carregar os logs: {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-4 text-sm text-muted-foreground">Nada por aqui.</div>,
});

const KIND_LABEL: Record<string, string> = {
  diario: "Resumo diário",
  aviso_diario: "Resumo diário",
  teste: "Envio de teste",
  aviso_teste: "Envio de teste",
  contas: "Contas a vencer",
  saude: "Saúde",
  aviso_vencimento_d1: "Vence amanhã",
  aviso_vencimento_d0: "Vence hoje",
  aviso_vencido: "Contas vencidas",
  aviso_saude_d1: "Saúde amanhã",
  aviso_saude_d0: "Saúde hoje",
};


const FILTROS = [
  { id: "todos", label: "Todos" },
  { id: "email", label: "E-mail" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "falhas", label: "Só falhas" },
] as const;

function extrairTentativas(detail: string | null) {
  const m = detail?.match(/tentativas:\s*(\d+)/i);
  if (m) return Number(m[1]);
  const m2 = detail?.match(/após\s*(\d+)\s*tentativas/i);
  return m2 ? Number(m2[1]) : 1;
}

function limparMotivo(detail: string | null) {
  if (!detail) return "";
  return detail.replace(/^tentativas:\s*\d+\s*—\s*/i, "").trim();
}

function ehSucesso(status: string) {
  return status === "enviado" || status === "ok" || status === "sucesso";
}

function formatarQuando(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function AvisosPage() {
  const buscar = useServerFn(logsAvisos);
  const limpar = useServerFn(limparLogsAvisos);
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("todos");
  const [limpando, setLimpando] = useState<"falhas" | "todos" | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["logs-avisos"],
    queryFn: () => buscar({ data: undefined }),
  });

  async function limparLogs(escopo: "falhas" | "todos") {
    setLimpando(escopo);
    try {
      await limpar({ data: { escopo } });
      await refetch();
      toast.success(escopo === "todos" ? "Histórico apagado." : "Avisos com falha apagados.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível limpar agora.");
    } finally {
      setLimpando(null);
    }
  }


  const itens = data?.itens ?? [];
  const lista = useMemo(() => {
    return itens.filter((i) => {
      if (filtro === "email") return i.channel === "email";
      if (filtro === "whatsapp") return i.channel === "whatsapp";
      if (filtro === "falhas") return !ehSucesso(i.status);
      return true;
    });
  }, [itens, filtro]);

  const falhas = itens.filter((i) => !ehSucesso(i.status)).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Logs de avisos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada tentativa de envio por e-mail e WhatsApp, com horário de Brasília, destinatário,
            tipo, motivo da falha e número de tentativas.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {FILTROS.map((f) => (
              <Button
                key={f.id}
                size="sm"
                variant={filtro === f.id ? "secondary" : "ghost"}
                onClick={() => setFiltro(f.id)}
              >
                {f.label}
                {f.id === "falhas" && falhas > 0 && (
                  <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-destructive-foreground">
                    {falhas}
                  </span>
                )}
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-2">
              <RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
              Atualizar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              disabled={limpando !== null || falhas === 0}
              onClick={() => limparLogs("falhas")}
            >
              <Trash2 className="size-4" />
              {limpando === "falhas" ? "Limpando…" : "Limpar falhas"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="gap-2"
              disabled={limpando !== null || itens.length === 0}
              onClick={() => {
                if (confirm("Apagar todo o histórico de avisos?")) limparLogs("todos");
              }}
            >
              <Trash2 className="size-4" />
              {limpando === "todos" ? "Limpando…" : "Limpar tudo"}
            </Button>

          </div>
        </div>
        <NowCard />
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border/70 bg-card p-6 text-sm text-muted-foreground">
          Carregando logs…
        </div>
      ) : lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <Send className="mx-auto mb-2 size-6 opacity-60" />
          Nenhum registro de envio {filtro === "falhas" ? "com falha " : ""}até agora.
        </div>
      ) : (
        <ul className="space-y-2">
          {lista.map((i) => {
            const ok = ehSucesso(i.status);
            const canalEmail = i.channel === "email";
            const destino = canalEmail ? data?.destinos.email : data?.destinos.whatsapp;
            const tentativas = extrairTentativas(i.detail);
            const motivo = limparMotivo(i.detail);
            return (
              <li
                key={i.id}
                className={cn(
                  "rounded-2xl border bg-card p-4 shadow-soft",
                  ok ? "border-border/70" : "border-destructive/45 bg-destructive/5",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-xl",
                      ok ? "bg-secondary text-secondary-foreground" : "bg-destructive/15 text-destructive",
                    )}
                  >
                    {canalEmail ? <Mail className="size-4" /> : <MessageCircle className="size-4" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {KIND_LABEL[i.kind] ?? i.kind}
                      <span className="text-muted-foreground"> · {canalEmail ? "E-mail" : "WhatsApp"}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Para: {destino || "não informado"} · referência {i.ref_date}
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-muted px-2 py-1 font-medium text-muted-foreground">
                      {tentativas} {tentativas === 1 ? "tentativa" : "tentativas"}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold",
                        ok
                          ? "bg-brand/15 text-brand"
                          : "bg-destructive text-destructive-foreground",
                      )}
                    >
                      {ok ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                      {i.status}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatarQuando(i.created_at)}
                    </span>
                  </div>
                </div>

                {motivo && (
                  <p
                    className={cn(
                      "mt-3 rounded-xl px-3 py-2 text-xs",
                      ok ? "bg-muted/60 text-muted-foreground" : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {ok ? "Detalhe: " : "Motivo da falha: "}
                    {motivo}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
