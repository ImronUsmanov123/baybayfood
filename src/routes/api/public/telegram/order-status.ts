import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Called by the database trigger (pg_net) right after an order status change.
// It only ever finishes delivery of a freshly created, undelivered notification
// row — it accepts no caller-supplied content and returns no user data.
const payloadSchema = z.object({
  notification_id: z.string().uuid(),
  order_id: z.string().uuid(),
  status: z.string().trim().max(40),
});

const MAX_AGE_MS = 10 * 60 * 1000;

export const Route = createFileRoute("/api/public/telegram/order-status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed;
        try {
          parsed = payloadSchema.parse(await request.json());
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: notif } = await supabaseAdmin
          .from("notifications")
          .select("id, user_id, title, body, order_id, created_at, delivered_to_telegram")
          .eq("id", parsed.notification_id)
          .maybeSingle();

        if (!notif || notif.delivered_to_telegram) return Response.json({ ok: true });
        if (Date.now() - new Date(notif.created_at).getTime() > MAX_AGE_MS) {
          return Response.json({ ok: true, skipped: "stale" });
        }

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("telegram_chat_id, notifications_enabled")
          .eq("id", notif.user_id)
          .maybeSingle();

        const tg = await import("@/lib/telegram-bot.server");
        const short = `#${(notif.order_id ?? parsed.order_id).slice(0, 8).toUpperCase()}`;
        const html = `🛵 <b>${escapeHtml(notif.title)}</b>\n\n${escapeHtml(notif.body)}\n<code>${short}</code>`;

        let delivered = false;
        if (profile?.telegram_chat_id && profile.notifications_enabled !== false) {
          delivered = await tg.sendMessageAnywhere(Number(profile.telegram_chat_id), html);
        }

        // Mirror the update to the shop's admin chat when one is configured.
        const adminChat = await tg.settingsAdminChatId();
        if (adminChat) {
          await tg.sendMessageAnywhere(
            adminChat,
            `📦 <b>Order update</b>\n<code>${short}</code> → <b>${escapeHtml(parsed.status)}</b>`,
          );
        }

        if (delivered) {
          await supabaseAdmin
            .from("notifications")
            .update({ delivered_to_telegram: true })
            .eq("id", notif.id);
        }

        return Response.json({ ok: true, delivered });
      },
    },
  },
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
