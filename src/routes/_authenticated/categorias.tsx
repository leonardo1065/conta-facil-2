import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCategories, useDeleteCategory, useSaveCategory, type EntryKind } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/categorias")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Categorias — Agenda de Contas" },
      { name: "description", content: "Crie e organize categorias de despesas e receitas com cores próprias." },
      { property: "og:title", content: "Categorias — Agenda de Contas" },
      {
        property: "og:description",
        content: "Crie e organize categorias de despesas e receitas com cores próprias.",
      },
    ],
  }),
  component: Categorias,
});

const CORES = ["#10b981", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b"];

function Categorias() {
  const { data: categories, error } = useCategories();
  const salvar = useSaveCategory();
  const excluir = useDeleteCategory();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [kind, setKind] = useState<EntryKind>("despesa");
  const [cor, setCor] = useState(CORES[0]);
  const [recorrencia, setRecorrencia] = useState<"nenhuma" | "mensal" | "semanal" | "parcelada">("nenhuma");
  const [parcelas, setParcelas] = useState(6);

  const despesas = (categories ?? []).filter((c) => c.kind === "despesa");
  const receitas = (categories ?? []).filter((c) => c.kind === "receita");

  function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    salvar.mutate(
      {
        values: {
          name: nome.trim(),
          kind,
          color: cor,
          icon: "tag",
          recurrence_mode: recorrencia,
          recurrence_interval: 1,
          recurrence_count: recorrencia === "parcelada" ? Math.max(1, Math.min(parcelas, 120)) : null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Categoria criada.");
          setNome("");
          setRecorrencia("nenhuma");
          setParcelas(6);
          setAberto(false);
        },
        onError: () => toast.error("Não foi possível criar a categoria."),
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Categorias</h1>
        <Button className="gap-2" onClick={() => setAberto(true)}>
          <Plus className="size-4" /> Nova
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          Não foi possível carregar suas categorias: {(error as Error).message}
        </p>
      )}

      <Grupo titulo="Despesas" itens={despesas} onDelete={(id) => excluir.mutate(id)} />
      <Grupo titulo="Receitas" itens={receitas} onDelete={(id) => excluir.mutate(id)} />

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova categoria</DialogTitle>
          </DialogHeader>
          <form onSubmit={criar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome-cat">Nome</Label>
              <Input id="nome-cat" value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as EntryKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="receita">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Repetição padrão</Label>
              <Select
                value={recorrencia}
                onValueChange={(v) => setRecorrencia(v as typeof recorrencia)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Sem repetição</SelectItem>
                  <SelectItem value="mensal">Conta recorrente (todo mês)</SelectItem>
                  <SelectItem value="semanal">Semanal (toda semana)</SelectItem>
                  <SelectItem value="parcelada">Prestação (nº de parcelas)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {recorrencia === "parcelada" && (
              <div className="space-y-2">
                <Label htmlFor="parcelas-cat">Quantas prestações?</Label>
                <Input
                  id="parcelas-cat"
                  type="number"
                  min={1}
                  max={120}
                  value={parcelas}
                  onChange={(e) => setParcelas(Number(e.target.value))}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {CORES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Cor ${c}`}
                    onClick={() => setCor(c)}
                    className="size-8 rounded-full ring-offset-2 ring-offset-background transition-all"
                    style={{ backgroundColor: c, boxShadow: cor === c ? `0 0 0 2px ${c}` : undefined }}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Criar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Grupo({
  titulo,
  itens,
  onDelete,
}: {
  titulo: string;
  itens: {
    id: string;
    name: string;
    color: string;
    recurrence_mode?: "nenhuma" | "mensal" | "semanal" | "parcelada";
    recurrence_count?: number | null;
  }[];
  onDelete: (id: string) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma categoria ainda.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {itens.map((c) => (
            <li key={c.id} className="card-elevated flex items-center gap-3 px-4 py-3">
              <span className="size-4 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="flex-1 truncate">
                {c.name}
                {c.recurrence_mode && c.recurrence_mode !== "nenhuma" && (
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {c.recurrence_mode === "mensal"
                      ? "todo mês"
                      : c.recurrence_mode === "semanal"
                        ? "semanal"
                        : `${c.recurrence_count ?? ""}x`}
                  </span>
                )}
              </span>
              <Button variant="ghost" size="icon" aria-label="Excluir" onClick={() => onDelete(c.id)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
