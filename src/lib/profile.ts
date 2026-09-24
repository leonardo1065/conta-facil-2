import { supabase } from "@/integrations/supabase/client";

export type ProfileSeed = {
  displayName?: string | null;
  email?: string | null;
};

// Evita consultar o banco a cada navegação para o mesmo usuário.
const verificados = new Set<string>();

/**
 * Garante que a linha do usuário logado exista em public.profiles.
 * O id do perfil é o mesmo id do usuário autenticado (auth.uid()).
 *
 * Nunca lança erro: o acesso à agenda não pode depender da criação do perfil.
 */
export async function ensureProfile(userId: string, seed: ProfileSeed = {}): Promise<void> {
  if (!userId || verificados.has(userId)) return;

  const email = seed.email?.trim() || null;

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!error && data) {
      verificados.add(userId);
      return;
    }

    if (error) {
      console.warn("[perfil] não foi possível verificar o perfil:", error.message);
    }

    // Tenta criar mesmo quando a verificação falhou: o pior caso é um erro de
    // chave duplicada, tratado logo abaixo.
    const { error: insertError } = await supabase.from("profiles").insert({
      id: userId,
      display_name: seed.displayName?.trim() || null,
      notify_email: email,
      health_notify_email: email,
    });

    if (insertError) {
      // 23505 = chave duplicada: o perfil já existia (criado por gatilho do banco
      // ou por uma chamada simultânea). Isso é sucesso.
      if (insertError.code === "23505") {
        verificados.add(userId);
        return;
      }
      console.warn("[perfil] não foi possível criar o perfil:", insertError.message);
      return;
    }

    verificados.add(userId);
  } catch (erro) {
    console.warn("[perfil] falha inesperada ao preparar o perfil:", erro);
  }
}
