import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha — Agenda de Contas" },
      { name: "description", content: "Crie uma nova senha para acessar sua Agenda de Contas." },
      { property: "og:title", content: "Nova senha — Agenda de Contas" },
      { property: "og:description", content: "Crie uma nova senha para acessar sua Agenda de Contas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [conf, setConf] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (senha.length < 6) return toast.error("A senha precisa ter pelo menos 6 caracteres.");
    if (senha !== conf) return toast.error("As duas senhas não são iguais.");
    setCarregando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setCarregando(false);
    if (error) return toast.error("Link expirado ou inválido. Peça um novo em Esqueci minha senha.");
    toast.success("Senha alterada! Você já está conectado.");
    navigate({ to: "/painel", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={salvar} className="card-elevated w-full max-w-md space-y-4 p-6">
        <h1 className="text-lg font-semibold">Criar nova senha</h1>
        <div className="space-y-2">
          <Label htmlFor="s1">Nova senha</Label>
          <Input id="s1" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="s2">Repita a senha</Label>
          <Input id="s2" type="password" value={conf} onChange={(e) => setConf(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={carregando}>
          {carregando ? "Salvando..." : "Salvar nova senha"}
        </Button>
      </form>
    </div>
  );
}
