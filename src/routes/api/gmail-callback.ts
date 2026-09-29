import { createFileRoute } from "@tanstack/react-start/server";

// Delega para a Edge Function — o redirect real vem de lá
const HANDLER = async ({ request }: { request: Request }) => {
  const url = request.url;
  // Chama a Edge Function que processa o callback
  const res = await fetch(
    `${Deno.env.get("SUPABASE_URL")!}/functions/v1/gmail-callback` + (url.includes("?") ? url.substring(url.indexOf("?")) : ""),
    {
      method:  "GET",
      headers: {
        Authorization: request.headers.get("Authorization") ?? "",
      },
    },
  );
  const redirect = res.headers.get("location") ?? `${Deno.env.get("APP_URL")}/#/painel`;
  return Response.redirect(redirect, 302);
};

export const Route = createFileRoute("/api/gmail-callback")({
  GET: HANDLER,
});
