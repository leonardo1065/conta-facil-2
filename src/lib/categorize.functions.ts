import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type SugestaoCategoria = {
  kind: "despesa" | "receita";
  category_id: string | null;
  category_name: string | null;
};

export const sugerirCategoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { description: string }) => {
    const description = String(input?.description ?? "").trim().slice(0, 300);
    if (description.length < 2) throw new Error("Informe a descrição.");
    return { description };
  })
  .handler(async ({ data, context }): Promise<SugestaoCategoria> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Recurso de sugestão não configurado.");

    const { data: cats, error } = await context.supabase
      .from("categories")
      .select("id, name, kind")
      .eq("user_id", context.userId);
    if (error) throw new Error("Não foi possível carregar suas categorias.");
    const lista = (cats ?? []) as { id: string; name: string; kind: "despesa" | "receita" }[];

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output } = await import("ai");


    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    const schema = z.object({
      kind: z.enum(["despesa", "receita"]),
      category_id: z.string().nullable(),
    });

    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      instructions:
        "Você classifica lançamentos financeiros pessoais no Brasil. Decida se é 'receita' (entrada de dinheiro: salário, vendas, reembolsos, rendimentos) ou 'despesa' (saída). Escolha o id da categoria mais adequada da lista, do mesmo tipo; se nenhuma servir, use null.",
      messages: [
        {
          role: "user",
          content: `Descrição: ${data.description}\n\nCategorias:\n${lista
            .map((c) => `- id=${c.id} | ${c.name} | ${c.kind}`)
            .join("\n")}`,
        },
      ],
      output: Output.object({ schema }),
      maxRetries: 0,
      providerOptions: {
        openai: { forceReasoning: true, reasoningEffort: "low", store: false, include: ["reasoning.encrypted_content"] },
      },
    });

    let out: z.infer<typeof schema>;
    try {
      out = (await result.output) as z.infer<typeof schema>;
    } catch (e) {
      const status = (e as { statusCode?: number })?.statusCode;
      console.error("sugerirCategoria", e);
      if (status === 429) throw new Error("Muitas solicitações. Aguarde um pouco e tente de novo.");
      if (status === 402) throw new Error("Créditos de IA esgotados no workspace.");
      throw new Error("Não foi possível sugerir a categoria agora.");
    }

    const cat = lista.find((c) => c.id === out.category_id && c.kind === out.kind) ?? null;
    return { kind: out.kind, category_id: cat?.id ?? null, category_name: cat?.name ?? null };
  });
