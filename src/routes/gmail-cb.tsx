import { useEffect } from "react";
import { useNavigate, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";

function GmailCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace("#", "?"));
    const status = params.get("status");
    const msg    = params.get("msg") ?? "";

    if (status === "ok") toast.success(msg || "Gmail conectado com sucesso!");
    else toast.error(msg || "Falha ao conectar Gmail");

    // Volta para as configurações após mostrar o toast
    setTimeout(() => navigate({ to: "/painel" }), 1500);
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center gap-3">
      <div className="animate-pulse text-muted-foreground">Processando conexão do Gmail…</div>
    </div>
  );
}

export const Route = createFileRoute("/gmail-cb")({
  head: () => ({ meta: [
    { title: "Conexão Gmail — Agenda de Contas" },
    { name: "description", content: "Confirmação da conexão do Gmail para avisos da Agenda de Contas." },
    { property: "og:title", content: "Conexão Gmail — Agenda de Contas" },
    { property: "og:description", content: "Confirmação da conexão do Gmail para avisos da Agenda de Contas." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: GmailCallbackPage,
});
