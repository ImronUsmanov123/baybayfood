// Server-only notification fan-out: writes an in-app record and delivers it
// through the Telegram bot when the customer has a linked chat.

type SupabaseAdmin = typeof import("@/integrations/supabase/client.server")["supabaseAdmin"];

export type NotifyInput = {
  userId: string;
  kind: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  orderId?: string | null;
  /** Optional richer Telegram-only body (HTML). Falls back to title + body. */
  telegramHtml?: string;
};

export async function notifyUser(input: NotifyInput): Promise<{ telegram: boolean }> {
  const { supabaseAdmin } = (await import("@/integrations/supabase/client.server")) as {
    supabaseAdmin: SupabaseAdmin;
  };

  let delivered = false;
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("telegram_chat_id, notifications_enabled")
      .eq("id", input.userId)
      .maybeSingle();

    if (profile?.telegram_chat_id && profile.notifications_enabled !== false) {
      const tg = await import("@/lib/telegram-bot.server");
      const html = input.telegramHtml ?? `<b>${escapeHtml(input.title)}</b>\n${escapeHtml(input.body)}`;
      delivered = await tg.sendMessageAnywhere(profile.telegram_chat_id, html);
    }
  } catch (e) {
    // Never let a notification failure break the user's action.
    console.error("[notify] telegram delivery failed", e);
  }

  const { error } = await supabaseAdmin.from("notifications").insert({
    user_id: input.userId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    image_url: input.imageUrl ?? null,
    order_id: input.orderId ?? null,
    delivered_to_telegram: delivered,
  });
  if (error) console.error("[notify] could not store notification", error);

  return { telegram: delivered };
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Broadcast a message to every registered user (used by Telegram admins). */
export async function broadcastToAllUsers(input: {
  kind?: string;
  title: string;
  body: string;
  imageUrl?: string | null;
}): Promise<{ count: number }> {
  const { supabaseAdmin } = (await import("@/integrations/supabase/client.server")) as {
    supabaseAdmin: SupabaseAdmin;
  };
  const { data: users, error } = await supabaseAdmin.from("profiles").select("id");
  if (error) throw new Error(error.message);
  const rows = (users ?? []).map((u) => ({
    user_id: u.id,
    kind: input.kind ?? "broadcast",
    title: input.title,
    body: input.body,
    image_url: input.imageUrl ?? null,
  }));
  if (rows.length === 0) return { count: 0 };
  const { error: insErr } = await supabaseAdmin.from("notifications").insert(rows);
  if (insErr) throw new Error(insErr.message);
  return { count: rows.length };
}
