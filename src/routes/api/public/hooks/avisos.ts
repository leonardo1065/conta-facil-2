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
        if (!esperado || apikey !== esperado) {
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
        } = await import("@/lib/avisos.server");

        const hora = horaSaoPaulo();
        const perfis = await perfisParaHora(hora);
        // Reenvio automático: quem já passou do horário e ainda não teve
        // envio bem-sucedido hoje entra de novo na fila.
        const reenvios = (await perfisParaReenvio(hora)).filter(
          (p) => !perfis.some((x) => x.id === p.id),
        );
        let enviados = 0;
        let ignorados = 0;
        let reenviados = 0;
        let vencimentos = 0;
        const falhas: string[] = [];

        for (const perfil of [...perfis, ...reenvios]) {
          const ehReenvio = !perfis.some((p) => p.id === perfil.id);
          try {
            // Avisos por vencimento: um dia antes e no dia (independentes do resumo).
            for (const v of await enviarAvisosVencimento(perfil)) {
              if (v.enviado) vencimentos++;
              else falhas.push(`${perfil.id} ${v.tipo}: ${v.status} — ${v.detalhe}`);
            }
            if (ehReenvio ? await pararTentativasHoje(perfil.id) : await jaEnviadoHoje(perfil.id)) {
              ignorados++;
              continue;
            }
            const r = await enviarResumo(perfil, { tipo: "diario" });
            if (r.enviado) {
              enviados++;
              if (ehReenvio) reenviados++;
            } else {
              ignorados++;
              falhas.push(`${perfil.id}: ${r.status} — ${r.detalhe}`);
            }
          } catch (error) {
            falhas.push(error instanceof Error ? error.message : "erro desconhecido");
          }
        }

        return Response.json({
          hora,
          perfis: perfis.length,
          candidatos_reenvio: reenvios.length,
          enviados,
          reenviados,
          vencimentos,
          ignorados,
          falhas,
        });

      },
    },
  },
});
