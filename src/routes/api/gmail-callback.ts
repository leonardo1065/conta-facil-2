import { createFileRoute } from '@tanstack/react-router'

// Delega para a Edge Function — o redirect real vem de lá
const HANDLER = async ({ request }: { request: Request }) => {
  const url = request.url;
  const backendUrl = process.env['SUPABASE_URL'];
  if (!backendUrl) return new Response("Conexão Gmail indisponível", { status: 503 });
  // Chama a Edge Function que processa o callback
  const res = await fetch(
    `${backendUrl}/functions/v1/gmail-callback` + (url.includes("?") ? url.substring(url.indexOf("?")) : ""),
    {
      method:  "GET",
      headers: {
        Authorization: request.headers.get("Authorization") ?? "",
      },
    },
  );
  const redirect = res.headers.get("location") ?? new URL("/painel", request.url).href;
  return Response.redirect(redirect, 302);
};

export const Route = createFileRoute("/api/gmail-callback")({
  server: { handlers: { GET: HANDLER } },
});
