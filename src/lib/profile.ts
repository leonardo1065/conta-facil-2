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
 */
export async function ensureProfile(userId: string, seed: ProfileSeed = {}): Promise<void> {
  if (!userId || verificados.has(userId)) return;

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[perfil] não foi possível verificar o perfil:", error.message);
    return;
  }

  if (data) {
    verificados.add(userId);
    return;
  }

  const email = seed.email?.trim() || null;

  const { error: insertError } = await supabase.from("profiles").insert({
    id: userId,
    display_name: seed.displayName?.trim() || null,
    notify_email: email,
    health_notify_email: email,
  });

  if (insertError) {
    console.warn("[perfil] não foi possível criar o perfil:", insertError.message);
    return;
  }

  verificados.add(userId);
}
