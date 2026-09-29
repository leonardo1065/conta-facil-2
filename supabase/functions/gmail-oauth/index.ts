import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID     = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Redirect_uri deve apontar para a rota de callback do app
const CALLBACK_URL = `${SUPABASE_URL}/api/gmail-callback`;
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

Deno.serve(async (req: Request) => {
  // Suporta GET (redirect direto) e POST com { url } para servir o link ao frontend
  let redirectToGoogle = false;

  if (req.method === "GET") {
    redirectToGoogle = true;
  } else if (req.method === "POST") {
    const { url } = await req.json();
    redirectToGoogle = !url; // POST sem url = iniciar o fluxo
  }

  if (!redirectToGoogle) {
    // Devolve o link de autorização sem redirecionar
    const params = new URLSearchParams({
      client_id:     GOOGLE_CLIENT_ID,
      redirect_uri:  CALLBACK_URL,
      response_type: "code",
      scope:         SCOPES,
      access_type:   "offline",
      prompt:        "consent",
    });
    return Response.json({
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    });
  }

  const params = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    redirect_uri:  CALLBACK_URL,
    response_type: "code",
    scope:         SCOPES,
    access_type:   "offline",
    prompt:        "consent",
  });

  return Response.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    302,
  );
});
