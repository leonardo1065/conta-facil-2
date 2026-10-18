import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
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
import { todayISO } from "@/lib/dates";
import {
  buscarCep,
  buscarCepPorEndereco,
  type Endereco,
  HEALTH_KIND_LABEL,
  PLACE_LABEL,
  useSaveHealthEvent,
  type HealthEvent,
  type HealthKind,
  type PlaceType,
} from "@/lib/health";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: HealthEvent | null;
};

const vazio = (date: string) => ({
  kind: "consulta" as HealthKind,
  title: "",
  scheduled_date: date,
  scheduled_time: "",
  place_type: "clinica" as PlaceType,
  place_name: "",
  phone: "",
  cep: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
  notes: "",
  is_recurring: false,
  recurrence_interval_months: 1,
});

export function HealthDialog({ open, onOpenChange, event }: Props) {
  const salvar = useSaveHealthEvent();
  const [form, setForm] = useState(vazio(todayISO()));
  const [buscando, setBuscando] = useState(false);
  const [buscandoEndereco, setBuscandoEndereco] = useState(false);
  const [sugestoes, setSugestoes] = useState<Endereco[]>([]);

  useEffect(() => {
    if (!open) return;
    setForm(
      event
        ? {
            kind: event.kind,
            title: event.title,
            scheduled_date: event.scheduled_date,
            scheduled_time: event.scheduled_time?.slice(0, 5) ?? "",
            place_type: event.place_type,
            place_name: event.place_name ?? "",
            phone: event.phone ?? "",
            cep: event.cep ?? "",
            street: event.street ?? "",
            number: event.number ?? "",
            complement: event.complement ?? "",
            district: event.district ?? "",
            city: event.city ?? "",
            state: event.state ?? "",
            notes: event.notes ?? "",
            is_recurring: event.is_recurring,
            recurrence_interval_months: event.recurrence_interval_months,
          }
        : vazio(todayISO()),
    );
  }, [open, event]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function preencherPorCep(cep: string) {
    if (cep.replace(/\D/g, "").length !== 8) return;
    setBuscando(true);
    try {
      const end = await buscarCep(cep);
      setForm((f) => ({
        ...f,
        cep: end.cep,
        street: end.street || f.street,
        district: end.district || f.district,
        city: end.city || f.city,
        state: end.state || f.state,
      }));
      toast.success("Endereço preenchido pelo CEP");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao buscar CEP");
    } finally {
      setBuscando(false);
    }
  }

  async function buscarPorEndereco() {
    setBuscandoEndereco(true);
    setSugestoes([]);
    try {
      const lista = await buscarCepPorEndereco(form.state, form.city, form.street);
      if (lista.length === 1) {
        const e = lista[0]!;
        setForm((f) => ({
          ...f,
          cep: e.cep,
          street: e.street || f.street,
          district: e.district || f.district,
          city: e.city || f.city,
          state: e.state || f.state,
        }));
        toast.success(`CEP encontrado: ${e.cep}`);
      } else {
        setSugestoes(lista);
        toast.success(`${lista.length} endereços encontrados, escolha abaixo`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao buscar CEP pelo endereço");
    } finally {
      setBuscandoEndereco(false);
    }
  }

  function escolherSugestao(e: Endereco) {
    setForm((f) => ({
      ...f,
      cep: e.cep,
      street: e.street || f.street,
      district: e.district || f.district,
      city: e.city || f.city,
      state: e.state || f.state,
    }));
    setSugestoes([]);
    toast.success(`CEP ${e.cep} aplicado`);
  }

  async function onSalvar() {
    if (!form.title.trim()) {
      toast.error("Informe o que está agendado");
      return;
    }
    try {
      await salvar.mutateAsync({
        id: event?.id,
        values: {
          kind: form.kind,
          title: form.title.trim(),
          scheduled_date: form.scheduled_date,
          scheduled_time: form.scheduled_time ? form.scheduled_time : null,
          place_type: form.place_type,
          place_name: form.place_name.trim() || null,
          phone: form.phone.trim() || null,
          cep: form.cep.trim() || null,
          street: form.street.trim() || null,
          number: form.number.trim() || null,
          complement: form.complement.trim() || null,
          district: form.district.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          notes: form.notes.trim() || null,
          done: event?.done ?? false,
          is_recurring: form.is_recurring,
          recurrence_interval_months: Math.max(1, Number(form.recurrence_interval_months) || 1),
          series_id: event?.series_id ?? null,
        },
      });
      toast.success(event ? "Agendamento atualizado" : "Agendamento salvo");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? "Editar agendamento" : "Novo agendamento de saúde"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={form.kind} onValueChange={(v) => set("kind", v as HealthKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(HEALTH_KIND_LABEL).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">Descrição</Label>
            <Input
              id="title"
              placeholder="Consulta cardiologista / Exame de sangue / Losartana"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="data">Data</Label>
            <DateField
              id="data"
              value={form.scheduled_date}
              onChange={(iso) => set("scheduled_date", iso)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="hora">Hora</Label>
            <Input
              id="hora"
              type="time"
              value={form.scheduled_time}
              onChange={(e) => set("scheduled_time", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Local</Label>
            <Select value={form.place_type} onValueChange={(v) => set("place_type", v as PlaceType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PLACE_LABEL).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="place_name">Nome do local</Label>
            <Input
              id="place_name"
              placeholder="Hospital Santa Casa / Farmácia Popular"
              value={form.place_name}
              onChange={(e) => set("place_name", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefone do local</Label>
            <Input
              id="phone"
              inputMode="tel"
              placeholder="(11) 3333-4444"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cep">CEP (busca automática)</Label>
            <div className="flex gap-2">
              <Input
                id="cep"
                inputMode="numeric"
                placeholder="00000-000"
                value={form.cep}
                onChange={(e) => {
                  set("cep", e.target.value);
                  if (e.target.value.replace(/\D/g, "").length === 8) preencherPorCep(e.target.value);
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                disabled={buscando}
                onClick={() => preencherPorCep(form.cep)}
                aria-label="Buscar CEP"
              >
                <Search className="size-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="street">Logradouro</Label>
            <div className="flex gap-2">
              <Input
                id="street"
                placeholder="Av. Paulista"
                value={form.street}
                onChange={(e) => set("street", e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={buscandoEndereco}
                onClick={buscarPorEndereco}
              >
                <Search className="mr-2 size-4" />
                {buscandoEndereco ? "Buscando..." : "Buscar CEP"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Preencha cidade e UF abaixo e clique em “Buscar CEP” para achar o CEP pelo endereço.
            </p>
            {sugestoes.length > 0 && (
              <div className="mt-1 max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border/70 p-2">
                {sugestoes.map((s, i) => (
                  <button
                    key={`${s.cep}-${i}`}
                    type="button"
                    className="w-full rounded-md p-2 text-left text-sm hover:bg-muted"
                    onClick={() => escolherSugestao(s)}
                  >
                    <span className="font-medium">{s.cep}</span> — {s.street}, {s.district} · {s.city}/{s.state}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="number">Número</Label>
            <Input
              id="number"
              value={form.number}
              onChange={(e) => set("number", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="complement">Complemento</Label>
            <Input
              id="complement"
              placeholder="Sala, bloco, andar"
              value={form.complement}
              onChange={(e) => set("complement", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="district">Bairro</Label>
            <Input
              id="district"
              value={form.district}
              onChange={(e) => set("district", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">UF</Label>
              <Input
                id="state"
                maxLength={2}
                value={form.state}
                onChange={(e) => set("state", e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={!montarEndereco()}
              onClick={() => {
                const endereco = montarEndereco();
                if (endereco) {
                  window.open(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`,
                    "_blank",
                    "noopener,noreferrer",
                  );
                }
              }}
            >
              <MapPin className="mr-2 size-4" />
              Ver no mapa
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">
              Abre o Google Maps com o endereço e CEP preenchidos acima.
            </p>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 p-3 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={form.is_recurring}
                onChange={(e) => {
                  setForm((f) => ({
                    ...f,
                    is_recurring: e.target.checked,
                    recurrence_interval_months: 1,
                  }));
                }}
              />
              Repetir todo mês
            </label>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              rows={3}
              placeholder="Levar pedido médico, jejum de 8h, cartão do convênio..."
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSalvar} disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
