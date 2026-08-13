import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { enviarResumo, carregarPerfil, TipoAviso } from "./avisos.server";

export const testarEnvioManual = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        userId: z.string(),
        canal: z.enum(["email", "whatsapp"]),
        tipo: z.enum(["diario", "vencimento_d1", "vencimento_d0", "vencido", "teste"]).default("teste"),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const perfil = await carregarPerfil(data.userId);
    if (!perfil) throw new Error("Perfil não encontrado");

    // Forçamos o canal solicitado ativando-o temporariamente no objeto de perfil para o teste
    const perfilTeste = {
      ...perfil,
      notify_email: data.canal === "email",
      notify_whatsapp: data.canal === "whatsapp",
    };

    return enviarResumo(perfilTeste, {
      tipo: data.tipo as TipoAviso,
      ignorarVazio: true,
    });
  });
