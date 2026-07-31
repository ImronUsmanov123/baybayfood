import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notifications")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ids: z.array(z.string().uuid()).max(100).optional() }).parse(input))
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("read_at", null);
    if (data.ids?.length) q = q.in("id", data.ids);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Sends a test message so the customer can confirm the bot can reach them. */
export const sendTelegramTestNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("telegram_chat_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile?.telegram_chat_id) throw new Error("No Telegram account is linked to your profile yet.");

    const tg = await import("@/lib/telegram-bot.server");
    if (!tg.isBotConfigured()) {
      // Graceful degradation: no crash, just a readable explanation.
      console.error(`[notifications] ${tg.botConfigErrorDetail()}`);
      return { ok: false as const, reason: tg.botConfigError() };
    }

    const { notifyUser } = await import("@/lib/notify.server");
    const res = await notifyUser({
      userId: context.userId,
      kind: "test",
      title: "Notifications are working 🎉",
      body: "You'll get order updates and offers right here in Telegram.",
    });
    if (!res.telegram) throw new Error("We couldn't reach your Telegram chat. Open the bot and press Start.");
    return { ok: true as const, reason: null };
  });
