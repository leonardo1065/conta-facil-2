import { useCallback, useEffect, useState } from "react";
import { getDueBuckets } from "./dueBuckets";
import { formatBRL, formatDate, todayISO } from "./dates";
import type { Entry } from "./finance";

const CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutos
const storageKey = (entryId: string, day: string) => `aviso:${entryId}:${day}`;

function supported() {
  return typeof window !== "undefined" && typeof Notification !== "undefined";
}

function notificarConta(entry: Entry, vencida: boolean) {
  const day = todayISO();
  const key = storageKey(entry.id, day);
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, "1");

  new Notification(vencida ? "Conta vencida" : "Conta vence hoje", {
    body: `${entry.description} — ${formatBRL(entry.amount)} (${formatDate(entry.due_date)})`,
    tag: `conta-${entry.id}`,
    requireInteraction: true,
  });
}

/**
 * Avisa no navegador sobre contas que vencem hoje e que estão vencidas.
 * O alerta se repete todos os dias enquanto a conta não for marcada como paga.
 */
export function useDueNotifications(entries: Entry[] | undefined) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    supported() ? Notification.permission : "unsupported",
  );

  const pedirPermissao = useCallback(async () => {
    if (!supported()) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  useEffect(() => {
    if (!supported() || !entries) return;

    const verificar = () => {
      if (Notification.permission !== "granted") return;
      const { vencidas, hoje } = getDueBuckets(entries);
      hoje.forEach((e) => notificarConta(e, false));
      vencidas.forEach((e) => notificarConta(e, true));
    };

    verificar();
    const id = window.setInterval(verificar, CHECK_INTERVAL);
    const onFocus = () => verificar();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [entries, permission]);

  // Badge no ícone do app (PWA / navegadores compatíveis).
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (!nav.setAppBadge) return;
    const { vencidas, hoje } = getDueBuckets(entries);
    const total = vencidas.length + hoje.length;
    void (total > 0 ? nav.setAppBadge(total) : nav.clearAppBadge?.());
  }, [entries]);

  return { permission, pedirPermissao };
}
