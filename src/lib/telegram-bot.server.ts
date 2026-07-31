// Server-only helpers for calling the Telegram Bot API.
// Never import this file from client code.
//
// Transport resolution (in order):
//   1. TELEGRAM_BOT_TOKEN  -> direct calls to https://api.telegram.org (standalone,
//      no Lovable infrastructure required). This is the default for local/self-hosted.
//   2. LOVABLE_API_KEY + TELEGRAM_API_KEY -> Lovable connector gateway (optional).
//
// Every helper is non-throwing where the sign-in flow depends on it, so a missing
// or invalid configuration degrades to a readable message instead of a 500/503.

const GATEWAY_BASE = "https://connector-gateway.lovable.dev/telegram";
const DIRECT_BASE = "https://api.telegram.org";

type Transport =
  | { mode: "direct"; token: string }
  | { mode: "gateway"; lovableKey: string; connectionKey: string };

function env(name: string): string {
  // Defensive: `process` may be undefined in some runtimes, and reading a
  // missing variable must never throw — it just means "not configured".
  try {
    return (globalThis.process?.env?.[name] ?? "").trim();
  } catch {
    return "";
  }
}

/** Resolves the active transport, or null when the bot isn't configured. */
export function getTransport(): Transport | null {
  const token = env("TELEGRAM_BOT_TOKEN");
  if (token) return { mode: "direct", token };

  const lovableKey = env("LOVABLE_API_KEY");
  const connectionKey = env("TELEGRAM_API_KEY");
  if (lovableKey && connectionKey) return { mode: "gateway", lovableKey, connectionKey };

  return null;
}

/**
 * Safe configuration check: returns false instead of throwing when
 * TELEGRAM_BOT_TOKEN (or the gateway pair) is missing. Callers degrade
 * gracefully; nothing here can crash the server or block app startup.
 */
export function isBotConfigured(): boolean {
  try {
    return getTransport() !== null;
  } catch (e) {
    console.error("[telegram] configuration check failed", e);
    return false;
  }
}


/** Friendly, user-safe reason the bot can't be used (null when it is usable). */
export function botConfigError(): string | null {
  return isBotConfigured()
    ? null
    : "Telegram sign-in isn't available right now. You can keep browsing the menu — please try signing in later.";
}

/** Technical detail for server logs only (never shown to end users). */
export function botConfigErrorDetail(): string | null {
  return isBotConfigured()
    ? null
    : "Telegram bot is not configured. Set TELEGRAM_BOT_TOKEN (from @BotFather) in your environment.";
}


/** @deprecated kept for compatibility — only meaningful in gateway mode. */
export function telegramConnectionKey(): string {
  return env("TELEGRAM_API_KEY");
}

function apiUrl(t: Transport, method: string): string {
  const m = method.replace(/^\/+/, "");
  return t.mode === "direct" ? `${DIRECT_BASE}/bot${t.token}/${m}` : `${GATEWAY_BASE}/${m}`;
}

function authHeaders(t: Transport): Record<string, string> {
  return t.mode === "direct"
    ? {}
    : { Authorization: `Bearer ${t.lovableKey}`, "X-Connection-Api-Key": t.connectionKey };
}

export type TgApiResult<T> =
  | { ok: true; result: T }
  | { ok: false; status: number; description: string };

/** Hard ceiling for any Telegram network call, so a hung request can never
 *  block a server function (or app startup) indefinitely. */
const TG_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TG_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Raw call that surfaces Telegram's own status + description instead of a generic 500. */
export async function tgApiRaw<T = any>(
  method: string,
  body: Record<string, unknown> = {},
): Promise<TgApiResult<T>> {
  const t = getTransport();
  if (!t) {
    return { ok: false, status: 0, description: botConfigError()! };
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(apiUrl(t, method), {
      method: "POST",
      headers: { ...authHeaders(t), "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e: any) {
    const description =
      e?.name === "AbortError" ? "Telegram did not respond in time" : (e?.message ?? "Network error reaching Telegram");
    console.error(`[telegram] ${method} transport error: ${description}`);
    return { ok: false, status: 0, description };
  }

  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    const description = json?.description ?? `HTTP ${res.status}`;
    console.error(`[telegram] ${method} failed [${res.status}]: ${description}`);
    return { ok: false, status: res.status, description };
  }
  return { ok: true, result: json.result as T };
}


export async function tgApi<T = any>(method: string, body: Record<string, unknown> = {}): Promise<T> {
  const r = await tgApiRaw<T>(method, body);
  if (!r.ok) throw new Error(`Telegram ${method} failed [${r.status}]: ${r.description}`);
  return r.result;
}

/** Streams a Telegram file (already resolved `file_path`) through the active transport. */
export async function fetchTelegramFile(filePath: string): Promise<Response | null> {
  const t = getTransport();
  if (!t) return null;
  const url =
    t.mode === "direct"
      ? `${DIRECT_BASE}/file/bot${t.token}/${filePath}`
      : `${GATEWAY_BASE}/file/${filePath}`;
  try {
    return await fetch(url, { headers: authHeaders(t) });
  } catch (e) {
    console.error("[telegram] file download failed", e);
    return null;
  }
}

let cachedUsername: string | null = null;

/** Bot @username, resolved from the token via getMe (cached per worker). */
export async function botUsername(): Promise<string> {
  const name = await tryBotUsername();
  if (!name) throw new Error(botConfigError() ?? "Could not resolve the Telegram bot username.");
  return name;
}

/**
 * Non-throwing variant. Returns null when the bot isn't configured or Telegram
 * rejects the token, so the sign-in flow can degrade gracefully.
 */
export async function tryBotUsername(): Promise<string | null> {
  const configured = env("TELEGRAM_BOT_USERNAME");
  if (configured) return configured.replace(/^@/, "");
  if (cachedUsername) return cachedUsername;
  if (!isBotConfigured()) return null;

  const me = await tgApiRaw<{ username: string }>("getMe");
  if (!me.ok) {
    console.error(`[telegram] getMe failed [${me.status}]: ${me.description}`);
    return null;
  }
  cachedUsername = me.result.username;
  return cachedUsername;
}

export async function sendMessage(
  chatId: number,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<boolean> {
  const r = await tgApiRaw("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  });
  return r.ok;
}

/** Keyboard that asks the user to share their Telegram-verified phone number. */
export const SHARE_CONTACT_KEYBOARD = {
  keyboard: [[{ text: "📱 Share my phone number", request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
};

export const REMOVE_KEYBOARD = { remove_keyboard: true };

/**
 * Webhook secret. Explicit TELEGRAM_WEBHOOK_SECRET wins; otherwise it is derived
 * deterministically from the active credential so `setup` and `webhook` agree
 * without adding another secret. Returns null when the bot isn't configured.
 */
export async function deriveWebhookSecret(): Promise<string | null> {
  const explicit = env("TELEGRAM_WEBHOOK_SECRET");
  if (explicit) return explicit;

  const t = getTransport();
  if (!t) return null;
  const material = t.mode === "direct" ? t.token : t.connectionKey;
  const data = new TextEncoder().encode(`telegram-webhook:${material}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64Url(digest);
}

function base64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string compare for webhook secrets. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Admin-configured bot credentials (Admin Panel → Telegram Bot Settings).
// Used as a fallback when no TELEGRAM_BOT_TOKEN env var is present.
// ---------------------------------------------------------------------------

async function readSetting(key: string): Promise<string> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    return (data?.value ?? "").trim();
  } catch (e) {
    console.error("[telegram] could not read setting", key, e);
    return "";
  }
}

export async function settingsBotToken(): Promise<string> {
  // Env var wins so the bot works before the Admin Panel exists.
  return env("TELEGRAM_BOT_TOKEN") || (await readSetting("telegram_bot_token"));
}

export async function settingsAdminChatId(): Promise<number | null> {
  const envRaw =
    env("TELEGRAM_ADMIN_CHAT_ID") || env("TELEGRAM_ADMIN_CHAT_IDS").split(",")[0].trim();
  const raw = envRaw || (await readSetting("telegram_admin_chat_id"));
  const n = Number(raw);
  return Number.isFinite(n) && raw !== "" ? n : null;
}

/**
 * Sends a message using the env transport when configured, otherwise the
 * admin-provided token from app settings. Never throws.
 */
export async function sendMessageAnywhere(chatId: number, html: string): Promise<boolean> {
  if (isBotConfigured()) return sendMessage(chatId, html);

  const token = await settingsBotToken();
  if (!token) return false;
  try {
    const res = await fetchWithTimeout(`${DIRECT_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      console.error(`[telegram] sendMessage failed [${res.status}]: ${json?.description ?? "unknown"}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[telegram] sendMessage transport error", e);
    return false;
  }
}
