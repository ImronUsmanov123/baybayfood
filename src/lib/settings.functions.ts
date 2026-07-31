import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Strips control characters and trims — applied to every admin-entered value. */
function clean(v: string): string {
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u001f\u007f]/g, "").trim();
}

const telegramSettingsSchema = z.object({
  botToken: z
    .string()
    .trim()
    .max(200)
    .transform(clean)
    .refine((v) => v === "" || /^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(v), {
      message: "Enter a valid bot token from @BotFather (e.g. 123456789:AA...).",
    }),
  adminChatId: z
    .string()
    .trim()
    .max(32)
    .transform(clean)
    .refine((v) => v === "" || /^-?\d{5,20}$/.test(v), { message: "Chat ID must be a number." }),
});

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

/** Admin: current Telegram bot configuration (token is masked). */
export const adminGetTelegramSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["telegram_bot_token", "telegram_admin_chat_id"]);
    if (error) throw new Error(error.message);
    const map = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value as string]));
    const token = (map.telegram_bot_token ?? "") as string;
    return {
      hasToken: token.length > 0,
      tokenPreview: token ? `${token.slice(0, 6)}…${token.slice(-4)}` : "",
      adminChatId: (map.telegram_admin_chat_id ?? "") as string,
    };
  });

/** Admin: save the Telegram bot token / admin chat ID. */
export const adminSaveTelegramSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => telegramSettingsSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);

    const rows: Array<{ key: string; value: string; updated_at: string }> = [
      { key: "telegram_admin_chat_id", value: data.adminChatId, updated_at: new Date().toISOString() },
    ];
    // An empty token means "leave the current one untouched".
    if (data.botToken) {
      rows.push({ key: "telegram_bot_token", value: data.botToken, updated_at: new Date().toISOString() });
    }

    const { error } = await context.supabase.from("app_settings").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Admin: send a test message to the configured admin chat. */
export const adminTestTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await context.supabase
      .from("app_settings")
      .select("value")
      .eq("key", "telegram_admin_chat_id")
      .maybeSingle();
    const chatId = Number((data?.value ?? "").trim());
    if (!Number.isFinite(chatId) || !data?.value) throw new Error("Set an admin chat ID first.");

    const tg = await import("@/lib/telegram-bot.server");
    const ok = await tg.sendMessageAnywhere(chatId, "✅ <b>Bay Bay Food</b>\nTelegram bot sozlamalari ishlayapti. · Настройки бота работают.");
    if (!ok) throw new Error("Telegram rejected the message. Check the token and chat ID.");
    return { ok: true as const };
  });
