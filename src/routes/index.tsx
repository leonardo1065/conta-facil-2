import { createFileRoute, Link } from "@tanstack/react-router";
import { BellRing, CalendarDays, ScanLine, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Agenda de Contas — Financeiro Doméstico" },
      {
        name: "description",
        content:
          "Organize contas a pagar e receber em reais: alertas de vencimento, calendário mensal, recorrência e leitura de boleto e Pix.",
      },
      { property: "og:title", content: "Agenda de Contas — Financeiro Doméstico" },
      {
        property: "og:description",
        content:
          "Organize contas a pagar e receber em reais: alertas de vencimento, calendário mensal, recorrência e leitura de boleto e Pix.",
      },
    ],
  }),
  component: Home,
});

const recursos = [
  {
    icon: BellRing,
    titulo: "Vencimentos em destaque",
    texto: "Vencidas, vence hoje e próximos 7 dias sempre no topo, com aviso no navegador.",
  },
  {
    icon: CalendarDays,
    titulo: "Calendário do mês",
    texto: "Veja cada conta no dia do vencimento e quite direto pelo dia clicado.",
  },
  {
    icon: ScanLine,
    titulo: "Boleto e Pix",
    texto: "ele abre o wats e nao envia automatico",
  },
];

function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <span className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand text-primary-foreground shadow-soft">
            <Wallet className="size-5" />
          </span>
          <span className="font-semibold">Agenda de Contas</span>
        </span>
        <Button asChild variant="ghost">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24">
        <section className="py-14 text-center sm:py-20">
          <p className="text-sm font-medium tracking-wide text-primary uppercase">
            Financeiro doméstico
          </p>
          <h1 className="mx-auto mt-3 max-w-2xl text-4xl leading-tight font-bold sm:text-5xl">
            Nenhuma conta vence sem você saber
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Controle despesas e receitas da casa em reais, com destaque forte para o que está
            vencendo, recorrência automática e leitura de boletos.
          </p>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link to="/auth">Começar agora</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {recursos.map((r) => (
            <article key={r.titulo} className="card-elevated p-5">
              <r.icon className="size-6 text-primary" />
              <h2 className="mt-3 text-lg font-semibold">{r.titulo}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{r.texto}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
