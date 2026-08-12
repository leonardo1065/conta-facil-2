import { useEffect, useState } from "react";
import { CalendarDays, Clock } from "lucide-react";
import { TZ } from "@/lib/dates";
import { cn } from "@/lib/utils";

const mesFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, month: "long", year: "numeric" });
const diaFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const horaFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function capitalizar(t: string) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Mês corrente, data do dia e hora (America/Sao_Paulo), atualizando a cada segundo. */
export function NowCard({ className }: { className?: string }) {
  const [agora, setAgora] = useState<Date | null>(null);

  useEffect(() => {
    setAgora(new Date());
    const id = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={cn("card-elevated min-w-52 px-4 py-3", className)}>
      <p className="text-xs font-semibold tracking-wide text-primary uppercase">
        {agora ? capitalizar(mesFmt.format(agora)) : "—"}
      </p>
      <p className="mt-1 flex items-center gap-2 text-sm font-medium">
        <CalendarDays className="size-4 text-muted-foreground" />
        {agora ? capitalizar(diaFmt.format(agora)) : "Carregando..."}
      </p>
      <p className="mt-0.5 flex items-center gap-2 text-2xl font-bold tabular-nums">
        <Clock className="size-5 text-muted-foreground" />
        {agora ? horaFmt.format(agora) : "--:--:--"}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">Horário de Brasília (GMT-3)</p>
    </div>
  );
}
