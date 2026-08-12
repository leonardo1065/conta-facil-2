import { useEffect, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { addDays, parseISO, todayISO, toISO } from "@/lib/dates";
import { cn } from "@/lib/utils";

function isoParaBR(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function brParaISO(texto: string): string | null {
  const m = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mes, y] = m;
  const data = new Date(Number(y), Number(mes) - 1, Number(d));
  if (data.getMonth() !== Number(mes) - 1 || data.getDate() !== Number(d)) return null;
  return toISO(data);
}

function mascarar(v: string): string {
  const n = v.replace(/\D/g, "").slice(0, 8);
  if (n.length <= 2) return n;
  if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`;
  return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`;
}

type Props = {
  id?: string;
  /** Data em yyyy-MM-dd */
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  disabled?: boolean;
};

/** Campo de data: digite dd/mm/aaaa ou clique para escolher no calendário do mês. */
export function DateField({ id, value, onChange, className, disabled }: Props) {
  const [texto, setTexto] = useState(() => isoParaBR(value));
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    setTexto(isoParaBR(value));
  }, [value]);

  const selecionada = /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseISO(value) : undefined;

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <div className={cn("relative", className)}>
        <Input
          id={id}
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          disabled={disabled}
          value={texto}
          className="pr-10"
          onClick={() => setAberto(true)}
          onFocus={() => setAberto(true)}
          onChange={(e) => {
            const t = mascarar(e.target.value);
            setTexto(t);
            const iso = brParaISO(t);
            if (iso) onChange(iso);
          }}
          onBlur={() => setTexto(isoParaBR(value))}
        />
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Abrir calendário"
            disabled={disabled}
            onClick={() => setAberto((a) => !a)}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <CalendarIcon className="size-4" />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex items-center gap-1 border-b p-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              onChange(todayISO());
              setAberto(false);
            }}
          >
            Hoje
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              onChange(addDays(todayISO(), 1));
              setAberto(false);
            }}
          >
            Amanhã
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto text-muted-foreground"
            onClick={() => {
              onChange("");
              setTexto("");
              setAberto(false);
            }}
          >
            Limpar
          </Button>
        </div>
        <Calendar
          mode="single"
          locale={ptBR}
          selected={selecionada}
          defaultMonth={selecionada}
          onSelect={(d) => {
            if (!d) return;
            onChange(toISO(d));
            setAberto(false);
          }}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
