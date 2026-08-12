import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, RotateCcw, Save, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NowCard } from "@/components/NowCard";
import { useSaveSettings, useSettings } from "@/lib/settings";
import { previaAviso } from "@/lib/avisos.functions";
import {
  ASSUNTO_PADRAO,
  CONTEXTO_EXEMPLO,
  CORPO_PADRAO,
  TAGS,
  renderizarTemplate,
} from "@/lib/email-template";

export const Route = createFileRoute("/_authenticated/modelo-email")({
  head: () => ({
    meta: [
      { title: "Modelo do e-mail de aviso — Agenda de Contas" },
      {
        name: "description",
        content:
          "Edite o assunto e o corpo do e-mail de aviso de contas, use tags como data de vencimento e lista de contas e veja a prévia antes de salvar.",
      },
      { property: "og:title", content: "Modelo do e-mail de aviso — Agenda de Contas" },
      {
        property: "og:description",
        content:
          "Personalize o texto dos avisos de vencimento com tags dinâmicas e visualize o resultado em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModeloEmailPage,
  errorComponent: ({ error }) => (
    <div role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
      Não foi possível abrir o modelo: {error.message}
    </div>
  ),
});

function ModeloEmailPage() {
  const { data: settings, isLoading } = useSettings();
  const salvar = useSaveSettings();
  const buscarPrevia = useServerFn(previaAviso);

  const [assunto, setAssunto] = useState(ASSUNTO_PADRAO);
  const [corpo, setCorpo] = useState(CORPO_PADRAO);
  const [carregado, setCarregado] = useState(false);
  const corpoRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (carregado || !settings) return;
    setAssunto(settings.email_subject_tpl?.trim() || ASSUNTO_PADRAO);
    setCorpo(settings.email_body_tpl?.trim() || CORPO_PADRAO);
    setCarregado(true);
  }, [settings, carregado]);

  const previa = useMemo(
    () => renderizarTemplate(assunto, corpo, CONTEXTO_EXEMPLO),
    [assunto, corpo],
  );

  const previaReal = useMutation({
    mutationFn: () => buscarPrevia({ data: undefined }),
    onError: (e: Error) => toast.error("Não foi possível gerar a prévia", { description: e.message }),
  });

  function inserirTag(tag: string) {
    const el = corpoRef.current;
    if (!el) {
      setCorpo((c) => `${c}${tag}`);
      return;
    }
    const inicio = el.selectionStart ?? corpo.length;
    const fim = el.selectionEnd ?? corpo.length;
    const novo = `${corpo.slice(0, inicio)}${tag}${corpo.slice(fim)}`;
    setCorpo(novo);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(inicio + tag.length, inicio + tag.length);
    });
  }

  async function onSalvar() {
    try {
      await salvar.mutateAsync({
        email_subject_tpl: assunto.trim() || null,
        email_body_tpl: corpo.trim() || null,
      });
      toast.success("Modelo salvo", { description: "Os próximos avisos usarão este texto." });
    } catch (e) {
      toast.error("Não foi possível salvar", {
        description: e instanceof Error ? e.message : "Erro desconhecido",
      });
    }
  }

  function onRestaurar() {
    setAssunto(ASSUNTO_PADRAO);
    setCorpo(CORPO_PADRAO);
    toast.info("Modelo padrão restaurado (lembre de salvar)");
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Modelo do e-mail de aviso</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Personalize o assunto e o corpo dos avisos de vencimento. Use as tags abaixo para inserir
            a data de vencimento, o total e a lista de contas automaticamente.
          </p>
        </div>
        <NowCard />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
          <div className="space-y-2">
            <Label htmlFor="assunto">Assunto</Label>
            <Input
              id="assunto"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              placeholder={ASSUNTO_PADRAO}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="corpo">Corpo da mensagem</Label>
            <Textarea
              id="corpo"
              ref={corpoRef}
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              rows={12}
              className="font-mono text-xs"
              disabled={isLoading}
            />
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Tag className="size-3.5" /> Tags disponíveis (clique para inserir no corpo)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TAGS.map((t) => (
                <button
                  key={t.tag}
                  type="button"
                  title={t.descricao}
                  onClick={() => inserirTag(t.tag)}
                  className="rounded-lg border border-border/70 bg-muted/50 px-2 py-1 font-mono text-[11px] text-foreground transition hover:bg-muted"
                >
                  {t.tag}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={onSalvar} disabled={salvar.isPending || isLoading} className="gap-2">
              <Save className="size-4" />
              {salvar.isPending ? "Salvando…" : "Salvar modelo"}
            </Button>
            <Button variant="outline" onClick={onRestaurar} className="gap-2">
              <RotateCcw className="size-4" />
              Restaurar padrão
            </Button>
            <Button
              variant="secondary"
              onClick={() => previaReal.mutate()}
              disabled={previaReal.isPending}
              className="gap-2"
            >
              <Eye className="size-4" />
              {previaReal.isPending ? "Gerando…" : "Prévia com meus dados"}
            </Button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Prévia com dados de exemplo
            </p>
            <p className="mt-2 text-sm font-semibold">{previa.assunto}</p>
            <div
              className="mt-3 rounded-xl border border-border/60 bg-background p-4 text-sm [&_li]:my-0.5 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: previa.html }}
            />
          </div>

          {previaReal.data && (
            <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Prévia com seus dados reais de hoje
              </p>
              <p className="mt-2 text-sm font-semibold">{previaReal.data.assunto}</p>
              <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-border/60 bg-background p-4 text-xs">
                {previaReal.data.texto}
              </pre>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
