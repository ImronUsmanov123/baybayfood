import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizeUzPhone, maskUzPhone } from "@/lib/phone";
import {
  OTP_TTL_MS,
  RESEND_COOLDOWN_MS,
  MAX_RESENDS,
  MAX_ATTEMPTS,
  randomToken,
  randomCode,
  otpMessage,
  deepLinkFor,
} from "@/lib/auth-otp";

// Public server functions — no auth middleware. Anyone can start an OTP login.

/**
 * Non-throwing readiness probe for Telegram sign-in. Always resolves — a missing
 * TELEGRAM_BOT_TOKEN (or unreachable Telegram) reports `available: false` so the
 * UI can render a calm "sign-in disabled" state instead of an error banner.
 */
export const telegramAuthStatus = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const tg = await import("@/lib/telegram-bot.server");
    if (!tg.isBotConfigured()) {
      return { available: false as const, reason: tg.botConfigError() };
    }
    return { available: true as const, reason: null };
  } catch (e) {
    console.error("[auth] telegram status probe failed", e);
    return {
      available: false as const,
      reason: "Telegram sign-in isn't available right now. You can keep browsing the menu — please try signing in later.",
    };
  }
});


export const requestTelegramOtp = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        phone: z
          .string()
          .trim()
          .min(4)
          .max(24)
          .transform((v, ctx) => {
            const e164 = normalizeUzPhone(v);
            if (!e164) {
              ctx.addIssue({ code: "custom" as const, message: "Enter a valid number: +998 xx xxx xx xx" });
              return z.NEVER;
            }
            return e164;
          }),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tg = await import("@/lib/telegram-bot.server");

    if (!tg.isBotConfigured()) {
      console.error(`[auth] ${tg.botConfigErrorDetail() ?? tg.botConfigError()}`);
      const expiresAtSoft = new Date(Date.now() + OTP_TTL_MS).toISOString();
      return {
        status: "bot_unavailable" as const,
        reason: tg.botConfigError(),
        startToken: "",
        phone: data.phone,
        maskedPhone: maskUzPhone(data.phone),
        deepLink: null,
        expiresAt: expiresAtSoft,
      };
    }


    const phone = data.phone;
    const startToken = randomToken(24);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    // Has this phone already been verified against a Telegram chat?
    const { data: account, error: accountError } = await supabaseAdmin
      .from("telegram_accounts")
      .select("chat_id, username, first_name, last_name")
      .eq("phone", phone)
      .maybeSingle();
    if (accountError) {
      console.error("[auth] could not read telegram account", accountError);
    }

    const code = account ? randomCode() : null;
    const codeHash = code ? await tg.sha256Hex(`${startToken}:${code}`) : null;

    const { error } = await supabaseAdmin.from("telegram_login_requests").insert({
      start_token: startToken,
      phone,
      expires_at: expiresAt,
      chat_id: account?.chat_id ?? null,
      telegram_username: account?.username ?? null,
      telegram_first_name: account?.first_name ?? null,
      telegram_last_name: account?.last_name ?? null,
      code_hash: codeHash,
      code_sent_at: code ? new Date().toISOString() : null,
    });
    if (error) {
      console.error("[auth] could not create login request", error);
      return {
        status: "service_unavailable" as const,
        startToken: "",
        phone,
        maskedPhone: maskUzPhone(phone),
        deepLink: null,
        expiresAt,
      };
    }

    if (account && code) {
      const sent = await tg.sendMessage(account.chat_id, otpMessage(code));
      if (!sent) {
        // The user blocked or deleted the chat — fall back to the deep link.
        await supabaseAdmin
          .from("telegram_login_requests")
          .update({ chat_id: null, code_hash: null, code_sent_at: null })
          .eq("start_token", startToken);
        const deepLink = await deepLinkFor(startToken);
        if (!deepLink) {
          return {
            status: "bot_unavailable" as const,
            startToken,
            phone,
            maskedPhone: maskUzPhone(phone),
            deepLink: null,
            expiresAt,
          };
        }
        return {
          status: "link_required" as const,
          startToken,
          phone,
          maskedPhone: maskUzPhone(phone),
          deepLink,
          expiresAt,
        };
      }
      return {
        status: "code_sent" as const,
        startToken,
        phone,
        maskedPhone: maskUzPhone(phone),
        deepLink: null,
        telegramFirstName: account.first_name,
        expiresAt,
      };
    }

    const deepLink = await deepLinkFor(startToken);
    if (!deepLink) {
      // getMe failed (e.g. 403 — token revoked or invalid). Don't crash the
      // registration flow: surface a soft error the UI can render.
      return {
        status: "bot_unavailable" as const,
        startToken,
        phone,
        maskedPhone: maskUzPhone(phone),
        deepLink: null,
        expiresAt,
      };
    }

    return {
      status: "link_required" as const,
      startToken,
      phone,
      maskedPhone: maskUzPhone(phone),
      deepLink,
      expiresAt,
    };
  });

export const pollTelegramLogin = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ startToken: z.string().min(4).max(80) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("telegram_login_requests")
      .select("chat_id, code_hash, telegram_first_name, telegram_username, expires_at, consumed_at")
      .eq("start_token", data.startToken)
      .maybeSingle();
    if (error) throw new Error("Sign-in lookup failed. Please try again.");
    if (!row) return { status: "not_found" as const };
    if (row.consumed_at) return { status: "consumed" as const };
    if (new Date(row.expires_at).getTime() < Date.now()) return { status: "expired" as const };
    if (row.chat_id && row.code_hash) {
      return {
        status: "code_sent" as const,
        telegramFirstName: row.telegram_first_name,
        telegramUsername: row.telegram_username,
      };
    }
    return { status: "pending" as const };
  });

export const resendTelegramOtp = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ startToken: z.string().min(4).max(80) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tg = await import("@/lib/telegram-bot.server");

    const { data: row } = await supabaseAdmin
      .from("telegram_login_requests")
      .select("*")
      .eq("start_token", data.startToken)
      .maybeSingle();
    if (!row) throw new Error("Sign-in session not found. Please start again.");
    if (!row.chat_id) throw new Error("Open the Telegram bot and share your number first.");
    if (row.resend_count >= MAX_RESENDS) throw new Error("Too many resends. Please start again.");
    if (row.code_sent_at && Date.now() - new Date(row.code_sent_at).getTime() < RESEND_COOLDOWN_MS) {
      throw new Error("Please wait a moment before requesting a new code.");
    }

    const code = randomCode();
    const codeHash = await tg.sha256Hex(`${row.start_token}:${code}`);
    const sent = await tg.sendMessage(row.chat_id, otpMessage(code));
    if (!sent) throw new Error("We couldn't reach your Telegram chat. Open the bot and try again.");

    await supabaseAdmin
      .from("telegram_login_requests")
      .update({
        code_hash: codeHash,
        code_sent_at: new Date().toISOString(),
        resend_count: row.resend_count + 1,
        attempts: 0,
        verified_at: null,
        consumed_at: null,
        expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
      })
      .eq("id", row.id);

    return { ok: true, resendsLeft: MAX_RESENDS - (row.resend_count + 1) };
  });

export const verifyTelegramLogin = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        startToken: z.string().min(4).max(80),
        code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sha256Hex } = await import("@/lib/telegram-bot.server");

    const { data: row, error } = await supabaseAdmin
      .from("telegram_login_requests")
      .select("*")
      .eq("start_token", data.startToken)
      .maybeSingle();
    if (error || !row) throw new Error("Sign-in session not found. Please start again.");
    if (row.attempts >= MAX_ATTEMPTS) throw new Error("Too many incorrect attempts. Please start again.");
    if (!row.chat_id || !row.code_hash) throw new Error("Open the Telegram bot to receive your code first.");

    const providedHash = await sha256Hex(`${row.start_token}:${data.code}`);
    if (providedHash !== row.code_hash) {
      const attempts = row.attempts + 1;
      await supabaseAdmin.from("telegram_login_requests").update({ attempts }).eq("id", row.id);
      const left = MAX_ATTEMPTS - attempts;
      throw new Error(
        left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many incorrect attempts. Please start again.",
      );
    }

    // The code is correct. Allow a short grace window after expiry/consumption so a
    // transient network failure while creating the session doesn't strand the user.
    const GRACE_MS = 2 * 60_000;
    const expiredFor = Date.now() - new Date(row.expires_at).getTime();
    if (expiredFor > GRACE_MS) throw new Error("The code expired. Please request a new one.");
    if (row.consumed_at && Date.now() - new Date(row.consumed_at).getTime() > GRACE_MS) {
      throw new Error("This code was already used. Please start again.");
    }

    const email = `tg${row.chat_id}@telegram.osh.pizza`;

    // Existing account for this Telegram identity?
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("telegram_chat_id", row.chat_id)
      .maybeSingle();

    let userId = existingProfile?.id ?? null;

    if (!userId) {
      const created = await supabaseAdmin.auth.admin.createUser({
        email,
        password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
        email_confirm: true,
        phone_confirm: false,
        user_metadata: {
          phone: row.phone,
          telegram_chat_id: String(row.chat_id),
          telegram_username: row.telegram_username,
          first_name: row.telegram_first_name,
          last_name: row.telegram_last_name,
        },
      });
      if (created.data?.user) {
        userId = created.data.user.id;
      } else {
        // Email already taken (profile row missing) — recover by listing.
        const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existing = list.data?.users.find((u) => u.email === email);
        if (!existing) {
          console.error("[auth] createUser failed", created.error);
          throw new Error("Could not create your account. Please try again.");
        }
        userId = existing.id;
      }
    }

    await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        phone: row.phone,
        telegram_chat_id: row.chat_id,
        telegram_username: row.telegram_username,
        first_name: row.telegram_first_name,
        last_name: row.telegram_last_name,
      },
      { onConflict: "id" },
    );

    const link = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error || !link.data?.properties?.hashed_token) {
      console.error("[auth] generateLink failed", link.error);
      throw new Error("Could not create your session. Please try again.");
    }

    // Only now mark the code as used, so a failure above never strands the user.
    await supabaseAdmin
      .from("telegram_login_requests")
      .update({ verified_at: new Date().toISOString(), consumed_at: new Date().toISOString() })
      .eq("id", row.id);

    return { email, tokenHash: link.data.properties.hashed_token };
  });
