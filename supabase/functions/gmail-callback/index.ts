import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID     = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CALLBACK_URL = `${SUPABASE_URL}/api/gmail-callback`;
const APP_URL       = Deno.env.get("APP_URL") ?? SUPABASE_URL;

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const code  = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  // Redireciona de volta ao app com resultado no hash
  const ok    = (msg: string) => Response.redirect(`${APP_URL}/#/gmail-cb?status=ok&msg=${encodeURIComponent(msg)}`, 302);
  const fail  = (msg: string) => Response.redirect(`${APP_URL}/#/gmail-cb?status=fail&msg=${encodeURIComponent(msg)}`, 302);

  if (error) return fail(`Google recusou: ${error}`);
  if (!code)  return fail("Código de autorização ausente");

  // Troca code por tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri:  CALLBACK_URL,
      grant_type:    "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const txt = await tokenRes.text();
    return fail(`Erro ao trocar código: ${txt}`);
  }

  const tokens = await tokenRes.json();
  const { access_token, refresh_token, expires_in } = tokens;
  if (!access_token) return fail("Token de acesso não retornado");

  // Obtém o e-mail do usuário logado (via header Authorization do browser)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return fail("Sessão não encontrada");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const userRes  = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  const user     = userRes.data.user;
  if (!user) return fail("Usuário não autenticado");

  const expiry = Math.floor(Date.now() / 1000) + (expires_in ?? 3600);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      oauth_access_token:  access_token,
      oauth_refresh_token: refresh_token ?? null,
      oauth_token_expiry:   expiry,
    })
    .eq("id", user.id);

  if (updateError) return fail(`Erro ao salvar tokens: ${updateError.message}`);
  return ok("Gmail conectado com sucesso!");
});
