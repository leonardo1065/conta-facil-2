import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { MailCheck, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { ensureProfile } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Agenda de Contas" },
      {
        name: "description",
        content: "Acesse sua Agenda de Contas para acompanhar vencimentos, pagamentos e receitas.",
      },
      { property: "og:title", content: "Entrar — Agenda de Contas" },
      {
        property: "og:description",
        content: "Acesse sua Agenda de Contas para acompanhar vencimentos, pagamentos e receitas.",
      },
    ],
  }),
  component: AuthPage,
});

type Aba = "entrar" | "criar";

function nomeDoUsuario(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const valor = (meta as Record<string, unknown>)["full_name"];
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

function AuthPage() {
  const navigate = useNavigate();
  const [aba, setAba] = useState<Aba>("entrar");
  const [carregando, setCarregando] = useState(false);
  const [confirmacaoPendente, setConfirmacaoPendente] = useState<string | null>(null);

  const [emailLogin, setEmailLogin] = useState("");
  const [senhaLogin, setSenhaLogin] = useState("");

  const [nome, setNome] = useState("");
  const [emailNovo, setEmailNovo] = useState("");
  const [senhaNova, setSenhaNova] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/painel", replace: true });
    });
  }, [navigate]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (carregando) return;
    setCarregando(true);
    const email = emailLogin.trim();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: senhaLogin });
      if (error) {
        if (/email not confirmed/i.test(error.message)) {
          setConfirmacaoPendente(email);
          toast.error("Sua conta ainda não foi confirmada. Reenvie o link abaixo e abra o e-mail.");
        } else if (/invalid login credentials/i.test(error.message)) {
          toast.error("E-mail ou senha incorretos. Se ainda não tem conta, use a aba Criar conta.");
        } else {
          toast.error(`Não foi possível entrar: ${error.message}`);
        }
        return;
      }
      await ensureProfile(data.user.id, {
        displayName: nomeDoUsuario(data.user.user_metadata),
        email: data.user.email ?? email,
      });
      navigate({ to: "/painel", replace: true });
    } finally {
      setCarregando(false);
    }
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    if (carregando) return;
    setCarregando(true);
    const email = emailNovo.trim();
    const apelido = nome.trim();
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senhaNova,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: apelido },
        },
      });

      if (error) {
        if (/already registered|already exists|user already/i.test(error.message)) {
          toast.error("Este e-mail já possui uma conta. Use a aba Entrar.");
          setEmailLogin(email);
          setAba("entrar");
          return;
        }
        toast.error(`Não foi possível criar a conta: ${error.message}`);
        return;
      }

      // O Supabase não devolve erro para e-mail já cadastrado: devolve o usuário
      // sem identidades. Nesse caso a conta já existe.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        toast.error("Este e-mail já possui uma conta. Use a aba Entrar.");
        setEmailLogin(email);
        setAba("entrar");
        return;
      }

      if (data.user && data.session) {
        await ensureProfile(data.user.id, { displayName: apelido, email });
        toast.success("Conta criada com sucesso!");
        navigate({ to: "/painel", replace: true });
        return;
      }

      // Conta criada, mas o primeiro acesso depende da confirmação do e-mail.
      setConfirmacaoPendente(email);
      setEmailLogin(email);
      toast.success("Conta criada! Abra o link enviado para o seu e-mail para liberar o acesso.");
    } finally {
      setCarregando(false);
    }
  }

  async function reenviar() {
    if (!confirmacaoPendente || carregando) return;
    setCarregando(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: confirmacaoPendente,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) toast.error(`Não foi possível reenviar: ${error.message}`);
      else toast.success("E-mail de confirmação reenviado.");
    } finally {
      setCarregando(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) return toast.error("Não foi possível entrar com o Google.");
    if (result.redirected) return;
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (user) {
      await ensureProfile(user.id, {
        displayName: nomeDoUsuario(user.user_metadata),
        email: user.email ?? null,
      });
    }
    navigate({ to: "/painel", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand text-primary-foreground shadow-soft">
            <Wallet className="size-5" />
          </span>
          <span className="text-lg font-semibold">Agenda de Contas</span>
        </Link>

        <div className="card-elevated p-6">
          <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="entrar">Entrar</TabsTrigger>
              <TabsTrigger value="criar">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="entrar">
              <form onSubmit={entrar} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={emailLogin}
                    onChange={(e) => setEmailLogin(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senha">Senha</Label>
                  <Input
                    id="senha"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={senhaLogin}
                    onChange={(e) => setSenhaLogin(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={carregando}>
                  {carregando ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="criar">
              <form onSubmit={cadastrar} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-novo">E-mail</Label>
                  <Input
                    id="email-novo"
                    type="email"
                    autoComplete="email"
                    required
                    value={emailNovo}
                    onChange={(e) => setEmailNovo(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senha-nova">Senha</Label>
                  <Input
                    id="senha-nova"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={senhaNova}
                    onChange={(e) => setSenhaNova(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={carregando}>
                  {carregando ? "Criando conta..." : "Criar conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {confirmacaoPendente && (
            <div className="mt-5 flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <MailCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  Enviamos um link de confirmação para{" "}
                  <span className="font-medium text-foreground">{confirmacaoPendente}</span>. Abra o link para
                  liberar o acesso e depois entre com sua senha.
                </p>
                <Button type="button" variant="outline" size="sm" disabled={carregando} onClick={reenviar}>
                  Reenviar e-mail de confirmação
                </Button>
              </div>
            </div>
          )}

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={google}>
            Continuar com Google
          </Button>
        </div>
      </div>
    </div>
  );
}
