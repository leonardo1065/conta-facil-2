import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarClock,
  Check,
  HeartPulse,
  MapPin,
  Phone,
  Pencil,
  Pill,
  Plus,
  Stethoscope,
  TestTube,
  Trash2,
} from "lucide-react";
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
import { HealthDialog } from "@/components/HealthDialog";
import { NowCard } from "@/components/NowCard";
import { formatDate, todayISO } from "@/lib/dates";
import {
  formatHealthAddress,
  HEALTH_KIND_LABEL,
  PLACE_LABEL,
  useDeleteHealthEvent,
  useHealthEvents,
  useToggleHealthDone,
  type HealthEvent,
} from "@/lib/health";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/saude")({
  head: () => ({
    meta: [
      { title: "Saúde — Agenda de Contas" },
      {
        name: "description",
        content:
          "Consultas, exames e retirada de remédios com data, hora, endereço buscado por CEP e telefone do local.",
      },
      { property: "og:title", content: "Saúde — Agenda de Contas" },
      {
        property: "og:description",
        content: "Agende consultas, exames e retirada de remédios com local, CEP e telefone.",
      },
    ],
  }),
  component: Saude,
});

const iconePorTipo = {
  consulta: Stethoscope,
  exame: TestTube,
  remedio: Pill,
} as const;

function Saude() {
  const { data: eventos, isLoading, error } = useHealthEvents();
  const alternar = useToggleHealthDone();
  const excluir = useDeleteHealthEvent();
  const [dialogo, setDialogo] = useState(false);
  const [emEdicao, setEmEdicao] = useState<HealthEvent | null>(null);
  const [paraExcluir, setParaExcluir] = useState<HealthEvent | null>(null);

  const hoje = todayISO();
  const { proximos, passados } = useMemo(() => {
    const lista = eventos ?? [];
    return {
      proximos: lista.filter((e) => !e.done && e.scheduled_date >= hoje),
      passados: lista.filter((e) => e.done || e.scheduled_date < hoje),
    };
  }, [eventos, hoje]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <HeartPulse className="size-6 text-primary" /> Saúde
          </h1>
          <p className="text-sm text-muted-foreground">
            Consultas, exames e retirada de remédios com local e horário.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <NowCard className="hidden sm:block" />
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

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : error ? (
        <p className="text-sm text-destructive">
          Não foi possível carregar sua agenda de saúde: {(error as Error).message}
        </p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Agendados</h2>
            {proximos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum agendamento futuro.</p>
            ) : (
              proximos.map((e) => (
                <Cartao
                  key={e.id}
                  evento={e}
                  hoje={hoje}
                  onEdit={() => {
                    setEmEdicao(e);
                    setDialogo(true);
                  }}
                  onToggle={() =>
                    alternar.mutate(
                      { event: e, done: !e.done },
                      {
                        onSuccess: (criouProximo) =>
                          toast.success(criouProximo ? "Concluído e repetido para o próximo mês" : "Marcado como concluído"),
                      },
                    )
                  }
                  onDelete={() => setParaExcluir(e)}
                />
              ))
            )}
          </section>

          {passados.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Concluídos e anteriores</h2>
              {passados.map((e) => (
                <Cartao
                  key={e.id}
                  evento={e}
                  hoje={hoje}
                  onEdit={() => {
                    setEmEdicao(e);
                    setDialogo(true);
                  }}
                  onToggle={() => alternar.mutate({ event: e, done: !e.done })}
                  onDelete={() => setParaExcluir(e)}
                />
              ))}
            </section>
          )}
        </>
      )}

      <HealthDialog open={dialogo} onOpenChange={setDialogo} event={emEdicao} />

      <AlertDialog open={!!paraExcluir} onOpenChange={(o) => !o && setParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {paraExcluir?.title} — esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (paraExcluir) excluir.mutate(paraExcluir.id);
                setParaExcluir(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Cartao({
  evento,
  hoje,
  onEdit,
  onToggle,
  onDelete,
}: {
  evento: HealthEvent;
  hoje: string;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const Icon = iconePorTipo[evento.kind];
  const endereco = formatHealthAddress(evento);
  const isHoje = evento.scheduled_date === hoje && !evento.done;
  const atrasado = evento.scheduled_date < hoje && !evento.done;

  return (
    <article
      className={cn(
        "card-elevated flex flex-wrap items-start gap-3 p-4",
        isHoje && "border-warning/50 bg-warning/10",
        atrasado && "border-destructive/40 bg-destructive/5",
        evento.done && "opacity-70",
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
        <Icon className="size-5" />
      </span>

      <div className="min-w-48 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          <span className={cn(evento.done && "line-through")}>{evento.title}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {HEALTH_KIND_LABEL[evento.kind]}
          </span>
          {isHoje && (
            <span className="rounded-full bg-warning px-2 py-0.5 text-[11px] font-bold text-warning-foreground">
              hoje
            </span>
          )}
          {evento.is_recurring && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              todo mês
            </span>
          )}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarClock className="size-4" />
          {formatDate(evento.scheduled_date)}
          {evento.scheduled_time ? ` às ${evento.scheduled_time.slice(0, 5)}` : ""}
        </p>
        <p className="text-sm">
          {PLACE_LABEL[evento.place_type]}
          {evento.place_name ? ` · ${evento.place_name}` : ""}
        </p>
        {endereco && (
          <a
            className="flex items-center gap-1.5 text-sm text-primary hover:underline"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MapPin className="size-4" />
            {endereco}
            {evento.cep ? ` · CEP ${evento.cep}` : ""}
          </a>
        )}
        {evento.phone && (
          <a
            className="flex items-center gap-1.5 text-sm text-primary hover:underline"
            href={`tel:${evento.phone.replace(/\D/g, "")}`}
          >
            <Phone className="size-4" />
            {evento.phone}
          </a>
        )}
        {evento.notes && <p className="text-sm text-muted-foreground">{evento.notes}</p>}
      </div>

      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label={evento.done ? "Reabrir" : "Marcar como concluído"}
        >
          <Check className={cn("size-4", evento.done && "text-success")} />
        </Button>
        <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Editar">
          <Pencil className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Excluir">
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
    </article>
  );
}
