import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertCircle, Eye, EyeOff, MailCheck, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { ensureProfile } from "@/lib/profile";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
type ErroAuth = { message?: string | null; code?: string | null } | null | undefined;

const SENHA_MINIMA = 6;
const ESPERA_REENVIO = 60;

function nomeDoUsuario(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const valor = (meta as Record<string, unknown>)["full_name"];
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function contem(texto: string, padroes: RegExp[]): boolean {
  return padroes.some((p) => p.test(texto));
}

function textoDoErro(error: ErroAuth): string {
  return `${error?.code ?? ""} ${error?.message ?? ""}`.trim().toLowerCase();
}

function emailJaCadastrado(error: ErroAuth): boolean {
  return contem(textoDoErro(error), [
    /user_already_exists/,
    /email_exists/,
    /already registered/,
    /already exists/,
    /user already/,
  ]);
}

function emailNaoConfirmado(error: ErroAuth): boolean {
  return contem(textoDoErro(error), [/email not confirmed/, /not confirmed/]);
}

/**
 * Traduz os erros que o Supabase devolve no login/cadastro para uma mensagem
 * que explique exatamente o que aconteceu.
 */
function traduzirErro(error: ErroAuth, contexto: Aba): string {
  const texto = textoDoErro(error);

  if (!texto) {
    return contexto === "criar"
      ? "Não foi possível criar a conta. Tente novamente em alguns instantes."
      : "Não foi possível entrar. Tente novamente em alguns instantes.";
  }

  if (emailJaCadastrado(error)) {
    return "Este e-mail já possui uma conta. Use a aba Entrar para acessar.";
  }
  if (contem(texto, [/weak_password/, /password should be at least/, /password is too short/])) {
    return `A senha é muito fraca. Use pelo menos ${SENHA_MINIMA} caracteres.`;
  }
  if (contem(texto, [/email_address_invalid/, /invalid email/, /unable to validate email/])) {
    return "E-mail inválido. Confira o endereço digitado.";
  }
  if (contem(texto, [/signup_disabled/, /signups not allowed/, /signup is disabled/])) {
    return "No momento o cadastro de novas contas está desativado. Tente mais tarde ou entre com o Google.";
  }
  if (contem(texto, [/over_email_send_rate_limit/, /email rate limit/])) {
    return "Enviamos muitos e-mails em pouco tempo. Aguarde alguns minutos e tente novamente.";
  }
  if (contem(texto, [/over_request_rate_limit/, /too many requests/, /rate limit/])) {
    return "Muitas tentativas seguidas. Aguarde um instante e tente novamente.";
  }
  if (contem(texto, [/database error saving new user/, /unexpected_failure/, /database error/])) {
    return "O servidor recusou o cadastro no banco de dados. Tente novamente em alguns instantes.";
  }
  if (emailNaoConfirmado(error)) {
    return "Sua conta ainda não foi confirmada. Abra o link enviado ao seu e-mail.";
  }
  if (contem(texto, [/invalid login credentials/])) {
    return "E-mail ou senha incorretos. Se ainda não tem conta, use a aba Criar conta.";
  }
  if (contem(texto, [/captcha/])) {
    return "Não foi possível validar a proteção anti-robô. Recarregue a página e tente novamente.";
  }
  if (contem(texto, [/user_banned/, /banned/])) {
    return "Este acesso está bloqueado. Entre em contato com o suporte.";
  }
  if (contem(texto, [/failed to fetch/, /fetch failed/, /networkerror/, /network error/])) {
    return "Sem conexão com o servidor. Verifique sua internet e tente novamente.";
  }

  const original = error?.message?.trim();
  return original
    ? `Não foi possível concluir a operação: ${original}`
    : "Não foi possível concluir a operação. Tente novamente.";
}

function AuthPage() {
  const navigate = useNavigate();
  const [aba, setAba] = useState<Aba>("entrar");
  const [carregando, setCarregando] = useState(false);
  const [confirmacaoPendente, setConfirmacaoPendente] = useState<string | null>(null);
  const [segundosReenvio, setSegundosReenvio] = useState(0);

  const [emailLogin, setEmailLogin] = useState("");
  const [senhaLogin, setSenhaLogin] = useState("");
  const [erroLogin, setErroLogin] = useState<string | null>(null);
  const [mostrarSenhaLogin, setMostrarSenhaLogin] = useState(false);

  const [nome, setNome] = useState("");
  const [emailNovo, setEmailNovo] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaConfirma, setSenhaConfirma] = useState("");
  const [erroCadastro, setErroCadastro] = useState<string | null>(null);
  const [mostrarSenhaNova, setMostrarSenhaNova] = useState(false);
  const [mostrarConfirma, setMostrarConfirma] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/painel", replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    if (segundosReenvio <= 0) return;
    const timer = window.setTimeout(() => setSegundosReenvio((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [segundosReenvio]);

  function trocarAba(valor: string) {
    setAba(valor as Aba);
    setErroLogin(null);
    setErroCadastro(null);
  }

  async function entrar(e: FormEvent) {
    e.preventDefault();
    if (carregando) return;

    const email = emailLogin.trim().toLowerCase();
    if (!emailValido(email)) {
      setErroLogin("Digite um e-mail válido, por exemplo nome@provedor.com.");
      return;
    }
    if (!senhaLogin) {
      setErroLogin("Digite sua senha para entrar.");
      return;
    }

    setErroLogin(null);
    setCarregando(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: senhaLogin,
      });

      if (error) {
        const mensagem = traduzirErro(error, "entrar");
        setErroLogin(mensagem);
        toast.error(mensagem);
        if (emailNaoConfirmado(error)) {
          setConfirmacaoPendente(email);
          setEmailLogin(email);
        }
        return;
      }

      await ensureProfile(data.user.id, {
        displayName: nomeDoUsuario(data.user.user_metadata),
        email: data.user.email ?? email,
      });
      navigate({ to: "/painel", replace: true });
    } catch {
      const mensagem = "Sem conexão com o servidor. Verifique sua internet e tente novamente.";
      setErroLogin(mensagem);
      toast.error(mensagem);
    } finally {
      setCarregando(false);
    }
  }

  async function cadastrar(e: FormEvent) {
    e.preventDefault();
    if (carregando) return;

    const email = emailNovo.trim().toLowerCase();
    const apelido = nome.trim();

    if (apelido.length === 1) {
      setErroCadastro("O nome precisa ter pelo menos 2 letras (pode deixar em branco se preferir).");
      return;
    }
    if (!emailValido(email)) {
      setErroCadastro("Digite um e-mail válido, por exemplo nome@provedor.com.");
      return;
    }
    if (senhaNova.length < SENHA_MINIMA) {
      setErroCadastro(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
      return;
    }
    if (senhaNova !== senhaConfirma) {
      setErroCadastro("As duas senhas não são iguais. Confira o que foi digitado.");
      return;
    }

    setErroCadastro(null);
    setCarregando(true);
    const apelidoFinal = apelido || email.split("@")[0] || null;

    const tentarEntrarComContaExistente = async () => {
      const mensagemContaExistente = "Este e-mail já possui uma conta. Tentando entrar...";
      setEmailLogin(email);
      setSenhaLogin(senhaNova);
      setAba("entrar");
      setErroLogin(mensagemContaExistente);

      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password: senhaNova,
      });

      if (loginError) {
        const mensagemLogin = traduzirErro(loginError, "entrar");
        setErroLogin(mensagemLogin);
        toast.error(mensagemLogin);
        if (emailNaoConfirmado(loginError)) {
          setConfirmacaoPendente(email);
        }
        return;
      }

      if (!loginData.user) {
        const mensagemLogin = "Não foi possível concluir o login. Tente novamente.";
        setErroLogin(mensagemLogin);
        toast.error(mensagemLogin);
        return;
      }

      await ensureProfile(loginData.user.id, {
        displayName: nomeDoUsuario(loginData.user.user_metadata) ?? apelidoFinal,
        email: loginData.user.email ?? email,
      });
      setErroLogin(null);
      toast.success("Login realizado com sucesso!");
      navigate({ to: "/painel", replace: true });
    };

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senhaNova,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
          data: { full_name: apelidoFinal },
        },
      });

      if (error) {
        if (emailJaCadastrado(error)) {
          await tentarEntrarComContaExistente();
        } else {
          const mensagem = traduzirErro(error, "criar");
          setErroCadastro(mensagem);
          toast.error(mensagem);
        }
        return;
      }

      // O Supabase não devolve erro para e-mail já cadastrado: devolve o usuário
      // sem identidades. Nesse caso, tenta autenticar imediatamente com a senha informada.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        await tentarEntrarComContaExistente();
        return;
      }

      if (!data.user) {
        const mensagem = "O cadastro não foi concluído. Confira os dados e tente novamente.";
        setErroCadastro(mensagem);
        toast.error(mensagem);
        return;
      }

      if (data.session) {
        await ensureProfile(data.user.id, { displayName: apelidoFinal, email });
        toast.success("Conta criada com sucesso!");
        navigate({ to: "/painel", replace: true });
        return;
      }

      // Conta criada, mas o primeiro acesso depende da confirmação do e-mail.
      setConfirmacaoPendente(email);
      setEmailLogin(email);
      setSegundosReenvio(ESPERA_REENVIO);
      setSenhaNova("");
      setSenhaConfirma("");
      toast.success("Conta criada! Abra o link enviado ao seu e-mail para liberar o acesso.");
    } catch {
      const mensagem =
        "Não foi possível concluir o cadastro. Verifique sua internet e tente novamente.";
      setErroCadastro(mensagem);
      toast.error(mensagem);
    } finally {
      setCarregando(false);
    }
  }

  async function reenviar() {
    if (!confirmacaoPendente || carregando || segundosReenvio > 0) return;
    setCarregando(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: confirmacaoPendente,
        options: { emailRedirectTo: `${window.location.origin}/auth` },
      });
      if (error) {
        const mensagem = traduzirErro(error, "entrar");
        toast.error(mensagem);
        if (/rate limit|muitos e-mails|muitas tentativas/i.test(mensagem)) {
          setSegundosReenvio(ESPERA_REENVIO);
        }
        return;
      }
      setSegundosReenvio(ESPERA_REENVIO);
      toast.success("E-mail de confirmação reenviado. Confira também a caixa de spam.");
    } catch {
      toast.error("Não foi possível reenviar agora. Verifique sua internet e tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  async function google() {
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Não foi possível entrar com o Google. Tente novamente.");
        return;
      }
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
    } catch {
      toast.error("Não foi possível entrar com o Google. Tente novamente.");
    }
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
          <Tabs value={aba} onValueChange={trocarAba}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="entrar">Entrar</TabsTrigger>
              <TabsTrigger value="criar">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="entrar">
              <form onSubmit={entrar} className="space-y-4 pt-4" noValidate>
                {erroLogin && (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertTitle>Não foi possível entrar</AlertTitle>
                    <AlertDescription>{erroLogin}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="nome@provedor.com"
                    value={emailLogin}
                    onChange={(e) => setEmailLogin(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senha">Senha</Label>
                  <div className="relative">
                    <Input
                      id="senha"
                      type={mostrarSenhaLogin ? "text" : "password"}
                      autoComplete="current-password"
                      value={senhaLogin}
                      onChange={(e) => setSenhaLogin(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex size-8 items-center justify-center rounded-md bg-background/80 text-muted-foreground hover:bg-background hover:text-foreground"
                      onClick={() => setMostrarSenhaLogin((v) => !v)}
                      aria-label={mostrarSenhaLogin ? "Esconder senha" : "Mostrar senha"}
                    >
                      {mostrarSenhaLogin ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={carregando}>
                  {carregando ? "Entrando..." : "Entrar"}
                </Button>
                <button
                  type="button"
                  className="w-full text-sm text-primary underline"
                  onClick={async () => {
                    const email = emailLogin.trim().toLowerCase();
                    if (!emailValido(email)) {
                      setErroLogin("Digite seu e-mail acima para receber o link de nova senha.");
                      return;
                    }
                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: `${window.location.origin}/reset-password`,
                    });
                    if (error) toast.error(traduzirErro(error, "entrar"));
                    else toast.success("Enviamos um link para criar nova senha. Confira também o spam.");
                  }}
                >
                  Esqueci minha senha
                </button>
              </form>
            </TabsContent>

            <TabsContent value="criar">
              <form onSubmit={cadastrar} className="space-y-4 pt-4" noValidate>
                {erroCadastro && (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertTitle>Não foi possível criar a conta</AlertTitle>
                    <AlertDescription>{erroCadastro}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="nome">Nome (opcional)</Label>
                  <Input
                    id="nome"
                    autoComplete="name"
                    placeholder="Como quer ser chamado"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-novo">E-mail</Label>
                  <Input
                    id="email-novo"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="nome@provedor.com"
                    value={emailNovo}
                    onChange={(e) => setEmailNovo(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senha-nova">Senha</Label>
                  <div className="relative">
                    <Input
                      id="senha-nova"
                      type={mostrarSenhaNova ? "text" : "password"}
                      autoComplete="new-password"
                      value={senhaNova}
                      onChange={(e) => setSenhaNova(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex size-8 items-center justify-center rounded-md bg-background/80 text-muted-foreground hover:bg-background hover:text-foreground"
                      onClick={() => setMostrarSenhaNova((v) => !v)}
                      aria-label={mostrarSenhaNova ? "Esconder senha" : "Mostrar senha"}
                    >
                      {mostrarSenhaNova ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mínimo de {SENHA_MINIMA} caracteres.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senha-nova-confirma">Confirmar senha</Label>
                  <div className="relative">
                    <Input
                      id="senha-nova-confirma"
                      type={mostrarConfirma ? "text" : "password"}
                      autoComplete="new-password"
                      value={senhaConfirma}
                      onChange={(e) => setSenhaConfirma(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex size-8 items-center justify-center rounded-md bg-background/80 text-muted-foreground hover:bg-background hover:text-foreground"
                      onClick={() => setMostrarConfirma((v) => !v)}
                      aria-label={mostrarConfirma ? "Esconder confirmação" : "Mostrar confirmação"}
                    >
                      {mostrarConfirma ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                  </div>
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
                  <span className="font-medium text-foreground">{confirmacaoPendente}</span>. Abra o link
                  para liberar o acesso e depois entre com sua senha.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={carregando || segundosReenvio > 0}
                  onClick={reenviar}
                >
                  {segundosReenvio > 0
                    ? `Reenviar em ${segundosReenvio}s`
                    : "Reenviar e-mail de confirmação"}
                </Button>
              </div>
            </div>
          )}

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={google} disabled={carregando}>
            Continuar com Google
          </Button>
        </div>
      </div>
    </div>
  );
}
