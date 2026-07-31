import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCcw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  requestTelegramOtp,
  pollTelegramLogin,
  resendTelegramOtp,
  verifyTelegramLogin,
  telegramAuthStatus,
} from "@/lib/auth.functions";

import { useAuth } from "@/hooks/use-auth";
import { useT, useServerError } from "@/lib/i18n";
import { formatUzPhone, isValidUzPhone, nationalDigits } from "@/lib/phone";
import { tgHaptic } from "@/lib/telegram";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Kirish / Вход — Bay Bay Food" },
      {
        name: "description",
        content: "Telegram kodi bilan kiring. Войдите по коду из Telegram, чтобы заказать еду.",
      },
      { property: "og:title", content: "Kirish / Вход — Bay Bay Food" },
      { property: "og:description", content: "Bay Bay Food — parolsiz Telegram orqali kirish." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

/** Telegram verification codes are valid for a full 5 minutes. */
const CODE_TTL_SECONDS = 300;

function mmss(total: number) {
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

type Step = "phone" | "waiting" | "code" | "done";

function safeRedirect(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function AuthPage() {
  const { redirect } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const target = safeRedirect(redirect);
  const { t } = useT();
  const getServerError = useServerError();

  useEffect(() => {
    if (!loading && user) navigate({ to: target, replace: true });
  }, [loading, user, target, navigate]);

  const request = useServerFn(requestTelegramOtp);
  const poll = useServerFn(pollTelegramLogin);
  const resend = useServerFn(resendTelegramOtp);
  const verify = useServerFn(verifyTelegramLogin);
  const probeStatus = useServerFn(telegramAuthStatus);

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("+998 ");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [startToken, setStartToken] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [tgName, setTgName] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  // Verification codes stay valid for a full 5 minutes.
  const [codeLeft, setCodeLeft] = useState(0);
  // null = still probing. false = Telegram sign-in is intentionally disabled.
  const [tgAvailable, setTgAvailable] = useState<boolean | null>(null);
  const [disabledReason, setDisabledReason] = useState<string | null>(null);

  // Readiness probe. Never throws and never sets an error banner: if the probe
  // itself fails we simply keep the form enabled and let the submit decide.
  useEffect(() => {
    let active = true;
    void probeStatus()
      .then((res) => {
        if (!active) return;
        setTgAvailable(res.available);
        setDisabledReason(res.available ? null : (res.reason ?? null));
      })
      .catch(() => {
        if (active) setTgAvailable(true);
      });
    return () => {
      active = false;
    };
  }, [probeStatus]);


  const phoneValid = isValidUzPhone(phone);
  const digits = nationalDigits(phone).length;

  const reset = useCallback(() => {
    setStep("phone");
    setStartToken(null);
    setDeepLink(null);
    setCode("");
    setTgName(null);
    setError(null);
    setNotice(null);
    setCooldown(0);
    setCodeLeft(0);
  }, []);

  // Code expiry ticker (5 minutes)
  useEffect(() => {
    if (codeLeft <= 0) return;
    const id = window.setTimeout(() => setCodeLeft((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [codeLeft]);

  // Resend cooldown ticker
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  // Poll while the user links their Telegram account
  const stopped = useRef(false);
  useEffect(() => {
    if (step !== "waiting" || !startToken) return;
    stopped.current = false;
    const run = async () => {
      try {
        const res = await poll({ data: { startToken } });
        if (stopped.current) return;
        if (res.status === "code_sent") {
          tgHaptic("success");
          setTgName(res.telegramFirstName ?? null);
          setCooldown(45);
          setCodeLeft(CODE_TTL_SECONDS);
          setStep("code");
        } else if (res.status === "expired" || res.status === "consumed" || res.status === "not_found") {
          setError(t("request_expired"));
          reset();
        }
      } catch {
        /* transient — keep polling */
      }
    };
    const id = window.setInterval(run, 2500);
    void run();
    return () => {
      stopped.current = true;
      window.clearInterval(id);
    };
  }, [step, startToken, poll, reset]);

  const submitPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);
    if (!phoneValid) {
      setError(t("phone_invalid"));
      tgHaptic("warning");
      return;
    }
    setBusy(true);
    try {
      const res = await request({ data: { phone } });
      setMaskedPhone(res.maskedPhone);

      if (res.status === "bot_unavailable" && !res.startToken) {
        // The bot isn't configured/reachable at all — nothing to poll for.
        // Degrade to the calm disabled state instead of an error banner.
        setTgAvailable(false);
        setDisabledReason((res as any).reason ?? null);
        return;
      }

      if (res.status === "service_unavailable") {
        tgHaptic("warning");
        setError(t("err_start_failed"));
        return;
      }

      setStartToken(res.startToken);
      if (res.status === "code_sent") {
        tgHaptic("success");
        setTgName((res as any).telegramFirstName ?? null);
        setCooldown(45);
        setCodeLeft(CODE_TTL_SECONDS);
        setStep("code");
      } else {
        // Continue into the Telegram linking step. If the server didn't return a
        // deep link we fall back to the known bot username (null when unknown,
        // so we never send the user to a made-up t.me link).
        const link = res.deepLink ?? botStartLink(res.startToken);
        if (!link) {
          setTgAvailable(false);
          setDisabledReason(null);
          return;
        }

        setDeepLink(link);
        setStep("waiting");
      }



    } catch (err: any) {
      tgHaptic("warning");
      setError(getServerError(err));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = useCallback(
    async (value: string) => {
      if (!startToken || busy) return;
      setError(null);
      setBusy(true);
      try {
        const { tokenHash } = await verify({ data: { startToken, code: value } });
        const { error: vErr } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "magiclink",
        });
        if (vErr) throw vErr;
        tgHaptic("success");
        setStep("done");
        navigate({ to: target, replace: true });
      } catch (err: any) {
        tgHaptic("warning");
        setCode("");
        setError(getServerError(err));
      } finally {
        setBusy(false);
      }
    },
    [startToken, busy, verify, navigate, target],
  );

  const onResend = async () => {
    if (!startToken || cooldown > 0 || busy) return;
    setError(null);
    setBusy(true);
    try {
      await resend({ data: { startToken } });
      setNotice(t("fresh_code_sent"));
      setCooldown(45);
      setCodeLeft(CODE_TTL_SECONDS);
      tgHaptic("light");
    } catch (err: any) {
      setError(getServerError(err));
    } finally {
      setBusy(false);
    }
  };

  const heading = useMemo(() => {
    if (step === "phone") return t("auth_sign_in");
    if (step === "waiting") return t("auth_link_telegram");
    return t("auth_enter_code");
  }, [step, t]);

  return (
    <div className="mx-auto max-w-md min-h-screen pb-16">
      <header className="px-5 pt-6 pb-4 flex items-center gap-3">
        <Link
          to="/"
          aria-label={t("back_to_menu")}
          className="h-11 w-11 rounded-full bg-surface shadow-card flex items-center justify-center press"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" strokeWidth={2.5} />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-foreground font-display">{heading}</h1>
          <p className="text-xs text-muted-foreground font-semibold">{t("auth_secure_sub")}</p>
        </div>
      </header>

      <div className="px-5">
        <div className="rounded-3xl bg-primary text-primary-foreground p-5 shadow-chunky flex items-center gap-4">
          <div className="h-14 w-14 shrink-0 rounded-2xl bg-amber flex items-center justify-center text-amber-foreground">
            <ShieldCheck className="h-7 w-7" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-sm font-extrabold">{t("auth_tg_title")}</p>
            <p className="text-[11px] text-primary-foreground/70 font-semibold">
              {t("auth_tg_sub")}
            </p>
          </div>
        </div>

        {tgAvailable === false && (
          <div className="mt-3 rounded-3xl bg-surface shadow-card p-4">
            <p className="text-sm font-extrabold text-foreground">{t("auth_disabled_title")}</p>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
              {disabledReason ?? t("auth_disabled_default")}
            </p>
          </div>
        )}
      </div>


      <div className="px-5 mt-4" aria-live="polite">
        <AnimatePresence initial={false}>
          {error && (
            <motion.p
              key={error}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              role="alert"
              className="rounded-2xl bg-tomato/10 text-tomato px-4 py-3 text-sm font-bold"
            >
              {error}
            </motion.p>
          )}
          {!error && notice && (
            <motion.p
              key={notice}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="rounded-2xl bg-amber/20 text-foreground px-4 py-3 text-sm font-bold"
            >
              {notice}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        {step === "phone" && (
          <motion.form
            key="phone"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            onSubmit={submitPhone}
            className="px-5 mt-4 space-y-4"
          >
            <label className="block">
              <span className="text-xs font-extrabold text-foreground/60 uppercase tracking-wide">{t("phone_number")}</span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                autoFocus
                aria-invalid={digits > 0 && !phoneValid}
                value={phone}
                onChange={(e) => {
                  setError(null);
                  setPhone(formatUzPhone(e.target.value));
                }}
                onKeyDown={(e) => {
                  // Keep the +998 prefix locked in place.
                  if (e.key === "Backspace" && nationalDigits(phone).length === 0) e.preventDefault();
                }}
                placeholder="+998 90 123 45 67"
                className={`mt-2 w-full rounded-2xl bg-surface shadow-card px-4 py-4 text-foreground font-bold text-lg tracking-wide outline-none transition-shadow focus:ring-2 ${
                  digits > 0 && !phoneValid ? "ring-2 ring-tomato/60" : "focus:ring-amber"
                }`}
              />
              <span className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                {phoneValid ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-foreground" /> {t("phone_ok")}
                  </>
                ) : (
                  <>{t("phone_hint")}</>
                )}
              </span>
            </label>

            <button
              disabled={busy || !phoneValid || tgAvailable === false}
              type="submit"
              className="press w-full rounded-full bg-primary text-primary-foreground py-4 font-black shadow-chunky flex items-center justify-center gap-2 transition-opacity disabled:opacity-50 disabled:shadow-card"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              {tgAvailable === false ? t("auth_unavailable") : busy ? t("sending_code") : t("send_code")}

            </button>
            <p className="text-[11px] text-center text-muted-foreground font-semibold px-4">
              {t("agree_note")}
            </p>
          </motion.form>
        )}

        {step === "waiting" && (
          <motion.div
            key="waiting"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="px-5 mt-4 space-y-4"
          >
            <div className="rounded-3xl bg-surface shadow-card p-6 text-center">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-foreground animate-spin" strokeWidth={2.5} />
              </div>
              <h2 className="mt-4 font-black text-foreground text-lg font-display">{t("waiting_title")}</h2>
              <p className="mt-1 text-sm text-muted-foreground font-semibold">
                {t("waiting_sub")}
              </p>
              {maskedPhone && (
                <p className="mt-3 text-xs font-bold text-foreground/70">{t("linking_phone", { phone: maskedPhone })}</p>
              )}
              {deepLink && (
                <a
                  href={deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 press inline-flex items-center gap-2 rounded-full bg-telegram text-telegram-foreground px-6 py-3 font-black shadow-chunky"
                >
                  <ExternalLink className="h-5 w-5" strokeWidth={2.5} />
                  {t("open_bot")}
                </a>
              )}
              <p className="mt-4 text-[11px] font-semibold text-muted-foreground">
                {t("waiting_hint")}
              </p>
            </div>
            <button
              onClick={reset}
              className="press w-full rounded-full bg-muted text-foreground py-3 font-bold text-sm flex items-center justify-center gap-2"
            >
              <RefreshCcw className="h-4 w-4" /> {t("different_number")}
            </button>
          </motion.div>
        )}

        {step === "code" && (
          <motion.form
            key="code"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            onSubmit={(e) => {
              e.preventDefault();
              void submitCode(code);
            }}
            className="px-5 mt-4 space-y-4"
          >
            <div className="rounded-3xl bg-surface shadow-card p-5 text-center">
              <p className="text-sm text-muted-foreground font-semibold">
                {tgName ? t("code_sent_hi", { name: tgName }) : t("code_sent_to")}
                {maskedPhone ? <> {t("for_phone", { phone: maskedPhone })}</> : null}.
              </p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                aria-label={t("code_input_label")}
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(v);
                  setError(null);
                  if (v.length === 6) void submitCode(v);
                }}
                placeholder="······"
                className="mt-4 w-full rounded-2xl bg-muted px-4 py-4 text-foreground font-black text-3xl text-center tracking-[0.5em] outline-none focus:ring-2 focus:ring-amber"
              />
              <p className="mt-3 text-xs font-extrabold tabular-nums text-foreground/70">
                {codeLeft > 0 ? mmss(codeLeft) : "0:00"}
              </p>
              <button
                type="button"
                onClick={onResend}
                disabled={cooldown > 0 || busy}
                className="mt-4 text-xs font-bold text-foreground/70 underline underline-offset-4 disabled:no-underline disabled:text-muted-foreground"
              >
                {cooldown > 0 ? t("resend_in", { n: cooldown }) : t("resend")}
              </button>
            </div>

            <button
              disabled={busy || code.length !== 6}
              type="submit"
              className="press w-full rounded-full bg-primary text-primary-foreground py-4 font-black shadow-chunky flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-card"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
              {busy ? t("verifying") : t("verify_continue")}
            </button>
            <button
              type="button"
              onClick={reset}
              className="press w-full rounded-full bg-muted text-foreground py-3 font-bold text-sm flex items-center justify-center gap-2"
            >
              <RefreshCcw className="h-4 w-4" /> {t("start_over")}
            </button>
          </motion.form>
        )}

        {step === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-5 mt-6 text-center"
          >
            <div className="rounded-3xl bg-surface shadow-card p-8">
              <CheckCircle2 className="mx-auto h-12 w-12 text-foreground" strokeWidth={2.5} />
              <p className="mt-3 font-black text-foreground font-display text-lg">{t("youre_in")}</p>
              <p className="text-sm text-muted-foreground font-semibold">{t("redirecting")}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const BOT_USERNAME = ((import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined) ?? "").replace(
  /^@/,
  "",
);

/** Deep link fallback — null when we don't know the bot username (never guess). */
function botStartLink(startToken: string, username?: string | null): string | null {
  const name = (username ?? BOT_USERNAME).replace(/^@/, "");
  if (!name) return null;
  return startToken ? `https://t.me/${name}?start=${startToken}` : `https://t.me/${name}`;
}


