import { createFileRoute } from "@tanstack/react-router";

// Registers (or re-registers) the Telegram webhook against this deployment and
// reports the live connection health.
//   GET  <origin>/api/public/telegram/setup            -> status only
//   POST <origin>/api/public/telegram/setup            -> setWebhook to this origin
//   POST <origin>/api/public/telegram/setup?origin=... -> setWebhook to a tunnel URL
//   POST <origin>/api/public/telegram/setup?mode=delete -> deleteWebhook (for local polling)
//
// Never throws: a missing/invalid bot configuration is reported as JSON with a
// 200 so the caller sees the reason instead of an opaque 500/503.

export const Route = createFileRoute("/api/public/telegram/setup")({
  server: {
    handlers: {
      GET: async () => {
        const tg = await import("@/lib/telegram-bot.server");
        if (!tg.isBotConfigured()) {
          return Response.json({ ok: false, configured: false, error: tg.botConfigError() });
        }
        const me = await tg.tgApiRaw<any>("getMe");
        if (!me.ok) {
          return Response.json({ ok: false, configured: true, error: me.description });
        }
        const info = await tg.tgApiRaw<any>("getWebhookInfo");
        return Response.json({
          ok: true,
          configured: true,
          transport: tg.getTransport()?.mode ?? null,
          bot: { id: me.result.id, username: me.result.username },
          webhook: info.ok ? info.result : { error: info.description },
        });
      },

      POST: async ({ request }) => {
        const tg = await import("@/lib/telegram-bot.server");
        if (!tg.isBotConfigured()) {
          return Response.json({ ok: false, configured: false, error: tg.botConfigError() });
        }

        const url = new URL(request.url);

        if (url.searchParams.get("mode") === "delete") {
          const del = await tg.tgApiRaw("deleteWebhook", { drop_pending_updates: true });
          return Response.json({ ok: del.ok, deleted: del.ok, error: del.ok ? null : del.description });
        }

        const origin = url.searchParams.get("origin") ?? `${url.protocol}//${url.host}`;
        const webhookUrl = `${origin.replace(/\/+$/, "")}/api/public/telegram/webhook`;
        if (!webhookUrl.startsWith("https://")) {
          return Response.json({
            ok: false,
            webhookUrl,
            error:
              "Telegram only accepts an HTTPS webhook URL. For local development run `bun run bot:poll` instead, or pass ?origin=<your https tunnel>.",
          });
        }

        const secret = await tg.deriveWebhookSecret();
        const set = await tg.tgApiRaw("setWebhook", {
          url: webhookUrl,
          secret_token: secret ?? undefined,
          allowed_updates: ["message", "edited_message"],
          drop_pending_updates: true,
        });
        if (!set.ok) {
          return Response.json({ ok: false, webhookUrl, error: set.description });
        }

        const me = await tg.tgApiRaw<any>("getMe");
        const info = await tg.tgApiRaw<any>("getWebhookInfo");
        return Response.json({
          ok: true,
          webhookUrl,
          transport: tg.getTransport()?.mode ?? null,
          bot: me.ok ? { id: me.result.id, username: me.result.username } : null,
          webhook: info.ok ? info.result : null,
        });
      },
    },
  },
});
