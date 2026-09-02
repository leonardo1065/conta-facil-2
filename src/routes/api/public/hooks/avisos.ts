import { createFileRoute } from "@tanstack/react-router";

// Chamado pelo cron do banco a cada hora. Envia os avisos dos perfis
// cujo horário configurado é a hora atual em São Paulo.
export const Route = createFileRoute("/api/public/hooks/avisos")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace("Bearer ", "");
        const esperado = process.env.SUPABASE_PUBLISHABLE_KEY;

        console.log(`[hook:avisos] Chamada recebida. API Key presente: ${!!apikey}`);

        if (!esperado || apikey !== esperado) {
          console.error(`[hook:avisos] Não autorizado. Esperado configurado: ${!!esperado}`);
          return Response.json({ error: "não autorizado" }, { status: 401 });
        }

        const {
          horaSaoPaulo,
          perfisParaHora,
          perfisParaReenvio,
          enviarResumo,
          jaEnviadoHoje,
          pararTentativasHoje,
          enviarAvisosVencimento,
          enviarAvisosSaude,
        } = await import("@/lib/avisos.server");

        const hora = horaSaoPaulo();
        const perfis = await perfisParaHora(hora);
        
        console.log(`[hook:avisos] Hora SP: ${hora}. Perfis para esta hora: ${perfis.length}`);

        // Reenvio automático: quem já passou do horário e ainda não teve
        // envio bem-sucedido hoje entra de novo na fila.
        const reenvios = (await perfisParaReenvio(hora)).filter(
          (p) => !perfis.some((x) => x.id === p.id),
        );
        
        console.log(`[hook:avisos] Candidatos a reenvio: ${reenvios.length}`);

        let enviados = 0;
        let ignorados = 0;
        let reenviados = 0;
        let vencimentos = 0;
        let saude = 0;
        const falhas: string[] = [];

        for (const perfil of [...perfis, ...reenvios]) {
          const ehReenvio = !perfis.some((p) => p.id === perfil.id);
          try {
            // Avisos por vencimento: um dia antes e no dia (independentes do resumo).
            for (const v of await enviarAvisosVencimento(perfil)) {
              if (v.enviado) {
                vencimentos++;
              } else {
                console.warn(`[hook:avisos] Falha aviso vencimento usuário ${perfil.id}: ${v.status}`);
                falhas.push(`${perfil.id} ${v.tipo}: ${v.status} — ${v.detalhe}`);
              }
            }

            // Avisos de saúde: consultas, exames e retirada de remédios (véspera e no dia).
            for (const s of await enviarAvisosSaude(perfil)) {
              if (s.enviado) {
                saude++;
              } else {
                console.warn(`[hook:avisos] Falha aviso saúde usuário ${perfil.id}: ${s.status}`);
                falhas.push(`${perfil.id} ${s.tipo}: ${s.status} — ${s.detalhe}`);
              }
            }


            if (ehReenvio ? await pararTentativasHoje(perfil.id) : await jaEnviadoHoje(perfil.id)) {
              ignorados++;
              continue;
            }

            const r = await enviarResumo(perfil, { tipo: "diario" });
            if (r.enviado) {
              enviados++;
              if (ehReenvio) reenviados++;
              console.log(`[hook:avisos] Resumo enviado para ${perfil.id} (${perfil.notify_email})`);
            } else {
              ignorados++;
              console.warn(`[hook:avisos] Resumo ignorado/falha para ${perfil.id}: ${r.status}`);
              falhas.push(`${perfil.id}: ${r.status} — ${r.detalhe}`);
            }
          } catch (error) {
            const msg = error instanceof Error ? error.message : "erro desconhecido";
            console.error(`[hook:avisos] Erro fatal no perfil ${perfil.id}:`, error);
            falhas.push(`${perfil.id}: ${msg}`);
          }
        }

        return Response.json({
          hora,
          perfis: perfis.length,
          candidatos_reenvio: reenvios.length,
          enviados,
          reenviados,
          vencimentos,
          saude,
          ignorados,
          falhas,
        });
      },
    },
  },
});
