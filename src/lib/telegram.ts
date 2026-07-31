// Optional Telegram Mini App integration. Falls back gracefully in a browser.
export type TgUser = { id: number; first_name?: string; last_name?: string; username?: string; photo_url?: string };

export function initTelegram(): TgUser | null {
  if (typeof window === "undefined") return null;
  const tg = (window as any).Telegram?.WebApp;
  if (!tg) return null;
  try {
    tg.ready?.();
    tg.expand?.();
    tg.setHeaderColor?.("#FDF7EE");
    tg.setBackgroundColor?.("#FDF7EE");
    return tg.initDataUnsafe?.user ?? null;
  } catch {
    return null;
  }
}

export function tgHaptic(kind: "light" | "medium" | "heavy" | "success" | "warning" = "light") {
  if (typeof window === "undefined") return;
  const tg = (window as any).Telegram?.WebApp;
  const hf = tg?.HapticFeedback;
  if (!hf) return;
  if (kind === "success" || kind === "warning") hf.notificationOccurred?.(kind);
  else hf.impactOccurred?.(kind);
}
