// Shared OTP/login-request constants and generators. Kept out of
// *.functions.ts module scope so server-fn splitting can't drop them.

export const OTP_TTL_MS = 5 * 60_000;
export const RESEND_COOLDOWN_MS = 45_000;
export const MAX_RESENDS = 3;
export const MAX_ATTEMPTS = 5;

export function randomToken(len = 24): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(36))
    .join("")
    .slice(0, len);
}

export function randomCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(100000 + (buf[0] % 900000));
}

export function otpMessage(code: string): string {
  return `🍔 <b>Bay Bay Food</b> tasdiqlash kodi · код подтверждения:\n\n<b><code>${code}</code></b>\n\nKirishni yakunlash uchun kodni ilovaga kiriting. Kod 5 daqiqada tugaydi.\nВведите код в приложении. Он действует 5 минут.`;
}

export async function deepLinkFor(startToken: string): Promise<string | null> {
  const { tryBotUsername } = await import("@/lib/telegram-bot.server");
  const username = await tryBotUsername();
  return username ? `https://t.me/${username}?start=${startToken}` : null;
}
