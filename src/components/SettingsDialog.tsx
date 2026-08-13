import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  HeartPulse,
  Mail,
  MessageCircle,
  Send,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSaveSettings, useSettings, whatsappLink } from "@/lib/settings";
import { normalizarWhatsapp } from "@/lib/phone";
import {
  enviarAvisoTeste,
  statusWhatsapp,
  testarWhatsapp,
  validarWhatsapp,
} from "@/lib/avisos.functions";



import { useEntries } from "@/lib/finance";
import { getDueBuckets, sum } from "@/lib/dueBuckets";
import { formatBRL, formatDate } from "@/lib/dates";
import { useDueNotifications } from "@/lib/notifications";

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: settings } = useSettings();
  const salvar = useSaveSettings();
  const { data: entries } = useEntries();
  const { permission, pedirPermissao } = useDueNotifications(entries);
  const testar = useServerFn(enviarAvisoTeste);
  const checarZapi = useServerFn(statusWhatsapp);
  const { data: zapi } = useQuery({
    queryKey: ["status-whatsapp"],
    queryFn: () => checarZapi({ data: undefined }),
    enabled: open,
    staleTime: 60_000,
  });

  const [enviando, setEnviando] = useState(false);
  const [testandoZap, setTestandoZap] = useState(false);
  const [previa, setPrevia] = useState<string | null>(null);
  const [resultadoEmail, setResultadoEmail] = useState<{ ok: boolean; detalhe: string } | null>(
    null,
  );

  const testarZap = useServerFn(testarWhatsapp);
  const validarZapi = useServerFn(validarWhatsapp);
  const [validando, setValidando] = useState(false);
  const [diagnostico, setDiagnostico] = useState<{ ok: boolean; detalhe: string } | null>(null);
  const [testeEnviado, setTesteEnviado] = useState(false);
  const [testeConfirmado, setTesteConfirmado] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("zapi-teste-confirmado") === "1";
  });
  

  function confirmarRecebido() {
    setTesteConfirmado(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("zapi-teste-confirmado", "1");
    }
    toast.success("Integração confirmada. Envio automático liberado.");
  }


  async function onValidarZapi() {
    setValidando(true);
    setDiagnostico(null);
    try {
      const r = await validarZapi({ data: undefined });
      setDiagnostico({ ok: r.ok, detalhe: r.detalhe });
      if (r.ok) toast.success(r.detalhe);
      else toast.error(r.detalhe);
    } catch (e) {
      const detalhe = e instanceof Error ? e.message : "Falha ao verificar credenciais";
      setDiagnostico({ ok: false, detalhe });
      toast.error(detalhe);
    } finally {
      setValidando(false);
    }
  }


  async function onTestarWhatsapp() {
    const fone = normalizarWhatsapp(form.whatsapp);
    if (!fone.valido) {
      toast.error(fone.motivo ?? "Número de WhatsApp inválido");
      return;
    }
    setTestandoZap(true);
    try {
      const r = await testarZap({ data: { numero: fone.e164 } });
      if (r.enviado) {
        setTesteEnviado(true);
        toast.success(`Mensagem de teste enviada para ${r.numero ?? fone.formatado}`);
      }
      else toast.error(`WhatsApp: ${r.detalhe}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no teste de WhatsApp");
    } finally {
      setTestandoZap(false);
    }
  }


  const [form, setForm] = useState({
    notify_email: "",
    whatsapp: "",
    notify_days_before: "3",
    notify_hour: "8",
    health_days_before: "1",
    notify_enabled: true,
    notify_health: true,
    notify_whatsapp: false,
    smtp_user: "",
    smtp_pass: "",
  });

  useEffect(() => {
    if (!open) return;
    setPrevia(null);
    setForm({
      notify_email: settings?.notify_email ?? "",
      whatsapp: settings?.whatsapp ?? "",
      notify_days_before: String(settings?.notify_days_before ?? 3),
      notify_hour: String(settings?.notify_hour ?? 8),
      health_days_before: String(settings?.health_days_before ?? 1),
      notify_enabled: settings?.notify_enabled ?? true,
      notify_health: settings?.notify_health ?? true,
      notify_whatsapp: settings?.notify_whatsapp ?? false,
      smtp_user: settings?.smtp_config?.user ?? "",
      smtp_pass: settings?.smtp_config?.pass ?? "",
    });
  }, [open, settings]);

  const buckets = getDueBuckets(entries);
  const aVencer = [...buckets.vencidas, ...buckets.hoje, ...buckets.proximos];
  const fone = normalizarWhatsapp(form.whatsapp);
  const liberado = testeConfirmado || form.notify_whatsapp;



  function mensagemResumo() {
    if (aVencer.length === 0) return "Agenda de Contas: nenhuma conta vencendo nos próximos 7 dias.";
    const linhas = aVencer
      .slice(0, 15)
      .map((e) => `• ${e.description} — ${formatBRL(e.amount)} — vence ${formatDate(e.due_date)}`);
    return [
      `Agenda de Contas — ${aVencer.length} conta(s) a vencer (total ${formatBRL(sum(aVencer))}):`,
      ...linhas,
    ].join("\n");
  }

  async function onSalvar() {
    const email = form.notify_email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      toast.error("E-mail inválido");
      return;
    }
    const dias = Math.max(0, Math.min(30, Number(form.notify_days_before) || 0));
    const hora = Math.max(0, Math.min(23, Number(form.notify_hour) || 0));
    const diasSaude = Math.max(0, Math.min(30, Number(form.health_days_before) || 0));
    const whats = form.whatsapp.trim();
    const fone = normalizarWhatsapp(whats);
    if (whats && !fone.valido) {
      toast.error(fone.motivo ?? "Número de WhatsApp inválido");
      return;
    }
    if (form.notify_whatsapp && !fone.valido) {
      toast.error("Informe um número de WhatsApp válido com DDD");
      return;
    }
    try {
      const smtp_config = form.smtp_user.trim() && form.smtp_pass.trim() 
        ? {
            host: "smtp.gmail.com",
            port: 587,
            user: form.smtp_user.trim(),
            pass: form.smtp_pass.trim()
          }
        : null;

      await salvar.mutateAsync({
        notify_email: email || null,
        whatsapp: fone.valido ? fone.e164 : null,
        notify_days_before: dias,
        notify_hour: hora,
        health_days_before: diasSaude,
        notify_enabled: form.notify_enabled,
        notify_health: form.notify_health,
        notify_whatsapp: form.notify_whatsapp,
        smtp_config,
      });
      toast.success("Configurações salvas");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    }
  }

  async function onTestar() {
    const destino = form.notify_email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino)) {
      toast.error("Informe um e-mail válido para receber o teste");
      return;
    }
    setEnviando(true);
    setPrevia(null);
    setResultadoEmail(null);
    try {
      const r = await testar({ data: undefined });
      setPrevia(r.previa);
      if (r.whatsapp && !r.whatsapp.enviado) toast.error(`WhatsApp: ${r.whatsapp.detalhe}`);
      else if (r.whatsapp?.enviado) toast.success("Aviso de teste enviado pelo WhatsApp");
      const hora = new Date().toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
      });
      if (r.enviado) {
        setResultadoEmail({ ok: true, detalhe: `Enviado para ${destino} às ${hora}.` });
        toast.success("Aviso de teste enviado");
      } else if (!r.whatsapp) {
        setResultadoEmail({ ok: false, detalhe: r.detalhe ?? "Falha no envio" });
        toast.error(`Não foi possível enviar: ${r.detalhe}`);
      }
    } catch (e) {
      const detalhe = e instanceof Error ? e.message : "Falha no envio de teste";
      setResultadoEmail({ ok: false, detalhe });
      toast.error(detalhe);
    } finally {
      setEnviando(false);
    }
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações de avisos</DialogTitle>
          <DialogDescription>
            Defina como e quando você quer ser lembrado das contas a vencer e dos compromissos de
            saúde.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border/70 p-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Zap className="size-4" /> Aviso automático diário
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Enviado por e-mail todos os dias no horário escolhido (horário de Brasília).
              </p>
            </div>
            <Switch
              checked={form.notify_enabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, notify_enabled: v }))}
              aria-label="Ligar avisos automáticos"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notify_email" className="flex items-center gap-2">
              <Mail className="size-4" /> E-mail para avisos
            </Label>
            <Input
              id="notify_email"
              type="email"
              placeholder="voce@email.com"
              value={form.notify_email}
              onChange={(e) => setForm((f) => ({ ...f, notify_email: e.target.value }))}
            />
          </div>
          
          <div className="space-y-3 rounded-xl border border-brand/20 bg-brand/5 p-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-brand">
                <Mail className="size-4" /> Configuração do Gmail
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Para enviar avisos usando seu próprio Gmail. Digite seu e-mail e a senha de app (16 dígitos).
              </p>
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="smtp_user" className="text-xs">E-mail do Gmail</Label>
              <Input
                id="smtp_user"
                type="email"
                placeholder="seu-email@gmail.com"
                value={form.smtp_user}
                onChange={(e) => setForm((f) => ({ ...f, smtp_user: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="smtp_pass" className="text-xs">Senha de App (16 dígitos)</Label>
              <Input
                id="smtp_pass"
                type="password"
                placeholder="xxxx xxxx xxxx xxxx"
                value={form.smtp_pass}
                onChange={(e) => setForm((f) => ({ ...f, smtp_pass: e.target.value }))}
                className="h-8 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Não é sua senha normal. Gere em: Conta Google {" > "} Segurança {" > "} Senhas de App.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hora" className="flex items-center gap-2">
                <Clock className="size-4" /> Horário do aviso
              </Label>
              <Input
                id="hora"
                type="number"
                min={0}
                max={23}
                value={form.notify_hour}
                onChange={(e) => setForm((f) => ({ ...f, notify_hour: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Hora cheia, de 0 a 23 (GMT-3).</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dias">Avisar quantos dias antes</Label>
              <Input
                id="dias"
                type="number"
                min={0}
                max={30}
                value={form.notify_days_before}
                onChange={(e) => setForm((f) => ({ ...f, notify_days_before: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border/70 p-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-medium">
                <HeartPulse className="size-4" /> Incluir compromissos de saúde
              </p>
              <Switch
                checked={form.notify_health}
                onCheckedChange={(v) => setForm((f) => ({ ...f, notify_health: v }))}
                aria-label="Incluir saúde nos avisos"
              />
            </div>
            {form.notify_health && (
              <div className="space-y-1.5">
                <Label htmlFor="dias_saude">Avisar consultas/exames com quantos dias antes</Label>
                <Input
                  id="dias_saude"
                  type="number"
                  min={0}
                  max={30}
                  value={form.health_days_before}
                  onChange={(e) => setForm((f) => ({ ...f, health_days_before: e.target.value }))}
                />
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-xl border border-border/70 p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Mail className="size-4" /> Testar envio por e-mail
            </p>
            <p className="text-xs text-muted-foreground">
              Envia agora o resumo de avisos para{" "}
              <span className="font-medium text-foreground">
                {form.notify_email.trim() || "nenhum e-mail informado"}
              </span>
              . Salve antes se acabou de alterar o e-mail.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={enviando || !form.notify_email.trim()}
              onClick={onTestar}
            >
              <Send className="size-4" />
              {enviando ? "Enviando..." : "Enviar e-mail de teste"}
            </Button>
            {resultadoEmail && (
              <p
                className={
                  resultadoEmail.ok
                    ? "flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400"
                    : "flex items-center gap-1.5 text-xs text-destructive"
                }
              >
                {resultadoEmail.ok ? (
                  <CheckCircle2 className="size-3.5" />
                ) : (
                  <AlertTriangle className="size-3.5" />
                )}
                {resultadoEmail.detalhe}
              </p>
            )}
            {resultadoEmail?.ok && (
              <p className="text-xs text-muted-foreground">
                Não chegou em alguns minutos? Confira a caixa de spam e o histórico em Avisos.
              </p>
            )}
            {previa && (
              <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-muted p-2 text-xs whitespace-pre-wrap">
                {previa}
              </pre>
            )}
          </div>


          <div className="space-y-2 rounded-xl border border-border/70 p-3">
            <Label htmlFor="whatsapp" className="flex items-center gap-2">
              <MessageCircle className="size-4" /> WhatsApp
            </Label>
            <Input
              id="whatsapp"
              inputMode="tel"
              placeholder="+55 (11) 96742-2171"
              value={form.whatsapp}
              aria-invalid={!!form.whatsapp.trim() && !fone.valido}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
              onBlur={() => {
                if (fone.valido) setForm((f) => ({ ...f, whatsapp: fone.formatado }));
              }}
            />
            {form.whatsapp.trim() &&
              (fone.valido ? (
                <p className="text-xs text-muted-foreground">
                  Será enviado para <span className="font-medium">{fone.e164}</span> (padrão
                  internacional E.164).
                </p>
              ) : (
                <p className="text-xs text-destructive">{fone.motivo}</p>
              ))}



            {zapi && !zapi.pronto && (
              <div
                role="alert"
                className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
              >
                <p className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="size-3.5" /> Envio automático indisponível
                </p>
                <ul className="space-y-1">
                  {zapi.itens.map((item) => (
                    <li key={item.chave} className="flex items-start gap-1.5">
                      {item.ok ? (
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      )}
                      <span className={item.ok ? "text-muted-foreground" : undefined}>
                        <span className="font-mono">{item.chave}</span>{" "}
                        {item.ok ? "— ok" : `— ${item.problema}`}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-muted-foreground">
                  Salve os valores nos segredos do projeto (Z-API → aba Segurança para o
                  Client-Token) e clique em “Verificar credenciais”.
                </p>
              </div>
            )}
            {zapi?.pronto && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-3.5" /> Credenciais Z-API com formato válido.
              </p>
            )}
            <div className="space-y-3 rounded-lg border border-border/70 bg-muted/30 p-3">
              <p className="text-sm font-medium">Teste da integração Z-API</p>

              <div className="flex items-start gap-2">
                <PassoIcone ok={!!zapi?.pronto} numero={1} />
                <div className="space-y-1">
                  <p className="text-xs font-medium">Credenciais salvas nos segredos</p>
                  <p className="text-xs text-muted-foreground">
                    {zapi?.pronto
                      ? "Formato das três credenciais validado."
                      : "Salve ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN e ZAPI_CLIENT_TOKEN."}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <PassoIcone ok={!!diagnostico?.ok} numero={2} />
                <div className="w-full space-y-1">
                  <p className="text-xs font-medium">Conexão com a Z-API verificada</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={validando || !zapi?.pronto}
                    onClick={onValidarZapi}
                  >
                    <Zap className="size-4" />
                    {validando ? "Verificando..." : "Verificar credenciais"}
                  </Button>
                  {diagnostico && (
                    <p
                      className={
                        diagnostico.ok
                          ? "text-xs text-emerald-600 dark:text-emerald-400"
                          : "text-xs text-destructive"
                      }
                    >
                      {diagnostico.detalhe}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <PassoIcone ok={liberado} numero={3} />
                <div className="w-full space-y-1">
                  <p className="text-xs font-medium">Mensagem de teste recebida no seu WhatsApp</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={!diagnostico?.ok || testandoZap || !fone.valido}
                      onClick={onTestarWhatsapp}
                    >
                      <Send className="size-4" />
                      {testandoZap ? "Enviando..." : "Enviar teste pelo WhatsApp"}
                    </Button>
                    {testeEnviado && !liberado && (
                      <Button type="button" size="sm" className="gap-2" onClick={confirmarRecebido}>
                        <CheckCircle2 className="size-4" /> Recebi a mensagem
                      </Button>
                    )}
                  </div>
                  {!diagnostico?.ok && (
                    <p className="text-xs text-muted-foreground">
                      Faça a verificação do passo 2 antes de enviar o teste.
                    </p>
                  )}
                  {testeEnviado && !liberado && (
                    <p className="text-xs text-muted-foreground">
                      Confira o WhatsApp {fone.valido ? fone.formatado : ""} e confirme o
                      recebimento para liberar o envio automático.
                    </p>
                  )}
                  {liberado && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      Integração confirmada — envio automático liberado.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 bg-brand/5 border border-brand/20 p-3 rounded-xl">
              <div>
                <p className="text-sm font-medium">Enviar avisos automáticos por WhatsApp</p>
                <p className="text-xs text-muted-foreground">
                  Mesma programação do e-mail (horário e dias de antecedência).
                </p>
              </div>
              <Switch
                checked={form.notify_whatsapp}
                onCheckedChange={(v) => {
                  setForm((f) => ({ ...f, notify_whatsapp: v }));
                }}
                aria-label="Enviar avisos por WhatsApp"
              />
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              disabled={testandoZap || !fone.valido}
              onClick={onTestarWhatsapp}
            >
              <Send className="size-4" />
              {testandoZap ? "Enviando..." : "Enviar resumo por WhatsApp"}
            </Button>
            <p className="text-xs text-muted-foreground">
              O botão acima tenta enviar o resumo diretamente via Z-API. Para que funcione, você deve primeiro configurar as credenciais Z-API nos segredos do projeto.
            </p>


          </div>


          <div className="rounded-xl border border-border/70 p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Bell className="size-4" /> Avisos no navegador
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {permission === "granted"
                ? "Ativados neste dispositivo."
                : permission === "denied"
                  ? "Bloqueados nas permissões do navegador."
                  : "Ainda não ativados neste dispositivo."}
            </p>
            {permission !== "granted" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={pedirPermissao}
              >
                Ativar avisos
              </Button>
            )}
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

function PassoIcone({ ok, numero }: { ok: boolean; numero: number }) {
  if (ok) {
    return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />;
  }
  return (
    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-semibold text-muted-foreground">
      {numero}
    </span>
  );
}
