import { createFileRoute } from "@tanstack/react-router";

// Public webhook — Telegram calls this with /start <token>, shared contacts and
// plain messages. Security: the secret-token header (explicit
// TELEGRAM_WEBHOOK_SECRET, or one derived from the bot token).
//
// Always answers 200 for anything we intentionally skip: a non-2xx makes
// Telegram retry the same update forever.

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const tg = await import("@/lib/telegram-bot.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { normalizeUzPhone } = await import("@/lib/phone");

        if (!tg.isBotConfigured()) {
          console.error(`[telegram] webhook received but ${tg.botConfigError()}`);
          return Response.json({ ok: true, ignored: "bot_not_configured" });
        }

        const expected = await tg.deriveWebhookSecret();
        const provided = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (expected && !tg.safeEqual(provided, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }


        let update: any;
        try {
          update = await request.json();
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        const msg = update.message ?? update.edited_message;
        if (!msg?.chat?.id) return Response.json({ ok: true, ignored: true });

        const chatId: number = msg.chat.id;
        const from = msg.from ?? {};
        const OTP_TTL_MS = 5 * 60_000;

        // ---- Admin broadcast --------------------------------------------------
        // Admins are listed in the telegram_admins table OR in the
        // TELEGRAM_ADMIN_CHAT_IDS env var (comma-separated chat IDs).
        const envAdmins = (process.env.TELEGRAM_ADMIN_CHAT_IDS ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => Number(s))
          .filter((n) => Number.isFinite(n));
        let isAdmin = envAdmins.includes(chatId);
        if (!isAdmin) {
          const { data: adminRow } = await supabaseAdmin
            .from("telegram_admins")
            .select("chat_id")
            .eq("chat_id", chatId)
            .maybeSingle();
          isAdmin = !!adminRow;
        }

        const text = typeof msg.text === "string" ? msg.text.trim() : "";
        const caption = typeof msg.caption === "string" ? msg.caption.trim() : "";
        const isCommand = (text || caption).startsWith("/");
        const hasContent = !!(text || caption || msg.photo);

        if (isAdmin && hasContent && !isCommand) {
          let imageUrl: string | null = null;
          if (Array.isArray(msg.photo) && msg.photo.length > 0) {
            // Largest photo size = last entry.
            const biggest = msg.photo[msg.photo.length - 1];
            const file = await tg.tgApiRaw<{ file_path: string }>("getFile", {
              file_id: biggest.file_id,
            });
            if (file.ok) imageUrl = `tg:${file.result.file_path}`;
          }
          const bodyText = text || caption || "";
          const { broadcastToAllUsers } = await import("@/lib/notify.server");
          const res = await broadcastToAllUsers({
            kind: "broadcast",
            title: "📣 Announcement",
            body: bodyText || "Bay Bay Food yangiligi · Новости Bay Bay Food",
            imageUrl,
          });
          await tg.sendMessage(
            chatId,
            `✅ Broadcast delivered to <b>${res.count}</b> user(s).`,
          );
          return Response.json({ ok: true, broadcast: res.count });
        }

        // ---- /admin registration --------------------------------------------
        if (text === "/admin") {
          const envSecret = (process.env.TELEGRAM_ADMIN_JOIN_CODE ?? "").trim();
          if (!envSecret) {
            await tg.sendMessage(
              chatId,
              "ℹ️ Admin registration is disabled. Ask the app owner to set TELEGRAM_ADMIN_JOIN_CODE.",
            );
          } else {
            await tg.sendMessage(
              chatId,
              "🔑 Send <code>/admin &lt;join code&gt;</code> to register this chat as an admin broadcaster.",
            );
          }
          return Response.json({ ok: true });
        }
        if (text.startsWith("/admin ")) {
          const provided = text.slice(7).trim();
          const envSecret = (process.env.TELEGRAM_ADMIN_JOIN_CODE ?? "").trim();
          if (envSecret && provided && tg.safeEqual(provided, envSecret)) {
            await supabaseAdmin
              .from("telegram_admins")
              .upsert({ chat_id: chatId, label: from.username ?? null }, { onConflict: "chat_id" });
            await tg.sendMessage(
              chatId,
              "✅ Siz Bay Bay Food administratorisiz. Har qanday oddiy xabar (matn yoki rasm) barcha foydalanuvchilarga yuboriladi. · Вы администратор Bay Bay Food. Любое обычное сообщение будет разослано всем пользователям.",
            );
          } else {
            await tg.sendMessage(chatId, "⚠️ Invalid join code.");
          }
          return Response.json({ ok: true });
        }

        const otpText = (code: string) =>
          `🍔 <b>Bay Bay Food</b> tasdiqlash kodi · код подтверждения:\n\n<b><code>${code}</code></b>\n\nKirishni yakunlash uchun kodni ilovaga kiriting. Kod 5 daqiqada tugaydi.\nВведите код в приложении. Он действует 5 минут.`;

        const newCode = () => {
          const buf = new Uint32Array(1);
          crypto.getRandomValues(buf);
          return String(100000 + (buf[0] % 900000));
        };

        const issueCode = async (row: any) => {
          const code = newCode();
          const codeHash = await tg.sha256Hex(`${row.start_token}:${code}`);
          await supabaseAdmin
            .from("telegram_login_requests")
            .update({
              chat_id: chatId,
              code_hash: codeHash,
              code_sent_at: new Date().toISOString(),
              attempts: 0,
              expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
              telegram_username: from.username ?? null,
              telegram_first_name: from.first_name ?? null,
              telegram_last_name: from.last_name ?? null,
            })
            .eq("id", row.id);
          await tg.sendMessage(chatId, otpText(code), { reply_markup: tg.REMOVE_KEYBOARD });
        };

        // ---- Shared contact -------------------------------------------------
        if (msg.contact) {
          const contact = msg.contact;
          if (contact.user_id && contact.user_id !== from.id) {
            await tg.sendMessage(
              chatId,
              "⚠️ Please share <b>your own</b> phone number using the button below.",
              { reply_markup: tg.SHARE_CONTACT_KEYBOARD },
            );
            return Response.json({ ok: true });
          }

          const phone = normalizeUzPhone(contact.phone_number ?? "");
          if (!phone) {
            await tg.sendMessage(
              chatId,
              "⚠️ Bay Bay Food faqat O'zbekistonda yetkazib beradi, shuning uchun <b>+998</b> raqami kerak. · Bay Bay Food доставляет только по Узбекистану, нужен номер <b>+998</b>.",
              { reply_markup: tg.REMOVE_KEYBOARD },
            );
            return Response.json({ ok: true });
          }

          await supabaseAdmin.from("telegram_accounts").upsert(
            {
              chat_id: chatId,
              phone,
              username: from.username ?? null,
              first_name: from.first_name ?? null,
              last_name: from.last_name ?? null,
            },
            { onConflict: "chat_id" },
          );

          const { data: row } = await supabaseAdmin
            .from("telegram_login_requests")
            .select("*")
            .eq("phone", phone)
            .is("consumed_at", null)
            .gte("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!row) {
            await tg.sendMessage(
              chatId,
              "✅ Your number is verified. Head back to the app and request a code — it will arrive here instantly.",
              { reply_markup: tg.REMOVE_KEYBOARD },
            );
            return Response.json({ ok: true });
          }

          await issueCode(row);
          return Response.json({ ok: true });
        }

        if (typeof msg.text !== "string") return Response.json({ ok: true, ignored: true });
        // (text already computed above)

        // ---- /start [token] -------------------------------------------------
        if (text.startsWith("/start")) {
          const token = text.split(/\s+/)[1];

          const { data: account } = await supabaseAdmin
            .from("telegram_accounts")
            .select("phone")
            .eq("chat_id", chatId)
            .maybeSingle();

          if (!token) {
            await tg.sendMessage(
              chatId,
              "👋 <b>Bay Bay Food</b>ga xush kelibsiz!\n\nBu bot kirish kodlari va buyurtma holatini yuboradi. Ilovadan boshlang — raqamingizni kiriting.\n\nДобро пожаловать в Bay Bay Food! Бот присылает коды входа и статус заказа.",
              { reply_markup: tg.REMOVE_KEYBOARD },
            );
            return Response.json({ ok: true });
          }

          const { data: row } = await supabaseAdmin
            .from("telegram_login_requests")
            .select("*")
            .eq("start_token", token)
            .maybeSingle();

          if (!row) {
            await tg.sendMessage(chatId, "⚠️ This sign-in link is invalid. Please start again from the app.");
            return Response.json({ ok: true });
          }
          if (row.consumed_at) {
            await tg.sendMessage(chatId, "⚠️ This sign-in link was already used.");
            return Response.json({ ok: true });
          }
          if (new Date(row.expires_at).getTime() < Date.now()) {
            await tg.sendMessage(chatId, "⌛ This sign-in link expired. Please request a new code in the app.");
            return Response.json({ ok: true });
          }

          if (account?.phone === row.phone) {
            await issueCode(row);
            return Response.json({ ok: true });
          }

          await tg.sendMessage(
            chatId,
            "🔐 One quick step: tap the button below to confirm your phone number. We only use it to secure your account.",
            { reply_markup: tg.SHARE_CONTACT_KEYBOARD },
          );
          return Response.json({ ok: true });
        }

        if (text === "/help") {
          await tg.sendMessage(
            chatId,
            "🍔 <b>Bay Bay Food bot</b>\n\n• Kirish kodlari · коды входа\n• Buyurtma holati · статус заказа\n• Aksiyalar · акции\n\nBuyurtma berish uchun ilovani oching.",
            { reply_markup: tg.REMOVE_KEYBOARD },
          );
          return Response.json({ ok: true });
        }

        if (text === "/stop") {
          await supabaseAdmin
            .from("profiles")
            .update({ notifications_enabled: false })
            .eq("telegram_chat_id", chatId);
          await tg.sendMessage(chatId, "🔕 Notifications paused. Send /start to turn them back on.", {
            reply_markup: tg.REMOVE_KEYBOARD,
          });
          return Response.json({ ok: true });
        }

        await tg.sendMessage(
          chatId,
          "🍔 Buyurtma berish uchun Bay Bay Food ilovasini oching. /help — yordam. · Откройте приложение Bay Bay Food, чтобы сделать заказ.",
        );
        return Response.json({ ok: true });
      },
    },
  },
});
