/**
 * Local development bridge: Telegram long-polling -> your local webhook route.
 *
 * Telegram can only push webhooks to a public HTTPS URL, so during local
 * development we poll getUpdates and replay each update into
 * http://localhost:8080/api/public/telegram/webhook with the correct
 * secret-token header. That makes the OTP arrive in Telegram automatically,
 * exactly like production.
 *
 *   bun run bot:poll
 */

const TOKEN = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
const TARGET = (process.env.WEBHOOK_TARGET ?? "http://localhost:8080").replace(/\/+$/, "");
const WEBHOOK_URL = `${TARGET}/api/public/telegram/webhook`;

if (!TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN is missing. Add it to .env (get it from @BotFather).");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;

async function secretToken(): Promise<string> {
  const explicit = (process.env.TELEGRAM_WEBHOOK_SECRET ?? "").trim();
  if (explicit) return explicit;
  const data = new TextEncoder().encode(`telegram-webhook:${TOKEN}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  let bin = "";
  for (const b of new Uint8Array(digest)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function call(method: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as { ok: boolean; result?: any; description?: string };
}

async function main() {
  const secret = await secretToken();

  const me = await call("getMe");
  if (!me.ok) {
    console.error(`getMe failed: ${me.description}`);
    process.exit(1);
  }
  console.log(`🤖 Bot @${me.result.username} ready`);

  // getUpdates and webhooks are mutually exclusive.
  await call("deleteWebhook", { drop_pending_updates: false });
  console.log(`↪  Forwarding updates to ${WEBHOOK_URL}`);

  let offset = 0;
  for (;;) {
    const updates = await call("getUpdates", {
      offset,
      timeout: 25,
      allowed_updates: ["message", "edited_message"],
    }).catch((e) => ({ ok: false, description: String(e) }) as any);

    if (!updates.ok) {
      console.error(`getUpdates failed: ${updates.description}`);
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    for (const update of updates.result ?? []) {
      offset = update.update_id + 1;
      try {
        const res = await fetch(WEBHOOK_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-telegram-bot-api-secret-token": secret,
          },
          body: JSON.stringify(update),
        });
        console.log(`→ update ${update.update_id}: ${res.status}`);
        if (!res.ok) console.error(`   ${await res.text()}`);
      } catch (e) {
        console.error(`   delivery failed:`, e);
      }
    }
  }
}

void main();
