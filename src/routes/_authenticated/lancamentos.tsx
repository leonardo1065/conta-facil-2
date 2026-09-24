import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EntryList } from "@/components/EntryList";
import { EntryDialog } from "@/components/EntryDialog";
import { useEntries, type Entry } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/lancamentos")({
  head: () => ({
    meta: [
      { title: "Lançamentos — Agenda de Contas" },
      { name: "description", content: "Cadastre, edite, pague e exclua despesas e receitas da casa." },
      { property: "og:title", content: "Lançamentos — Agenda de Contas" },
      { property: "og:description", content: "Cadastre, edite, pague e exclua despesas e receitas da casa." },
    ],
  }),
  component: Lancamentos,
});

type Filtro = "todos" | "pendente" | "pago" | "receita";

function Lancamentos() {
  const { data: entries, isLoading, error } = useEntries();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [dialogo, setDialogo] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Entry | null>(null);

  const lista = useMemo(() => {
    return (entries ?? []).filter((e) => {
      if (filtro === "pendente" && !(e.kind === "despesa" && e.status === "pendente")) return false;
      if (filtro === "pago" && e.status !== "pago") return false;
      if (filtro === "receita" && e.kind !== "receita") return false;
      if (busca && !e.description.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [entries, filtro, busca]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Lançamentos</h1>
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por descrição"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
          <TabsList>
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="pendente">A pagar</TabsTrigger>
            <TabsTrigger value="pago">Pagos</TabsTrigger>
            <TabsTrigger value="receita">Receitas</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : error ? (
        <p className="text-sm text-destructive">
          Não foi possível carregar seus lançamentos: {(error as Error).message}
        </p>
      ) : (
        <EntryList
          entries={lista}
          onEdit={(e) => {
            setEmEdicao(e);
            setDialogo(true);
          }}
        />
      )}

      <EntryDialog open={dialogo} onOpenChange={setDialogo} entry={emEdicao} />
    </div>
  );
}
