import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bike,
  ChefHat,
  PackageCheck,
  Check,
  ChevronRight,
  User,
  Camera,
  Loader2,
  LogOut,
  Pencil,
  X,
  Bell,
  BellOff,
  Send,
} from "lucide-react";
import { formatUZS } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { listMyOrders } from "@/lib/orders.functions";
import { amIAdmin } from "@/lib/payments.functions";
import type { Tables } from "@/integrations/supabase/types";
import { formatUzPhone, isValidUzPhone } from "@/lib/phone";
import { sendTelegramTestNotification } from "@/lib/notifications.functions";
import { tgHaptic } from "@/lib/telegram";
import { useT, useSyncLangFromProfile, type Lang } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profil / Профиль — Bay Bay Food" },
      { name: "description", content: "Hisobingiz va buyurtmalar tarixi. Ваш аккаунт и история заказов." },
      { property: "og:title", content: "Profil / Профиль — Bay Bay Food" },
      { property: "og:description", content: "Hisobingiz va buyurtmalar tarixi. Ваш аккаунт и история заказов." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Profile,
});

type ProfileRow = Tables<"profiles">;
type OrderRow = Tables<"orders">;

function Profile() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { t, setLang } = useT();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchOrders = useServerFn(listMyOrders);
  const saveProfile = useServerFn(updateMyProfile);

  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const ordersQ = useQuery({ queryKey: ["orders"], queryFn: () => fetchOrders() });
  const checkAdmin = useServerFn(amIAdmin);
  const adminQ = useQuery({ queryKey: ["am-i-admin"], queryFn: () => checkAdmin() });
  useSyncLangFromProfile((profileQ.data?.language as Lang | undefined) ?? null);

  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profile = profileQ.data as ProfileRow | null | undefined;
  const avatarSrc = useAvatarUrl(profile?.avatar_url ?? null);
  const orders = (ordersQ.data ?? []) as OrderRow[];

  const displayName = useMemo(() => {
    if (!profile) return "…";
    const parts = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
    return parts || profile.username || (profile.telegram_username ? `@${profile.telegram_username}` : t("member"));
  }, [profile]);

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploading(true);
    setAvatarError(null);
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError(t("avatar_too_large"));
      setUploading(false);
      return;
    }
    try {
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().slice(0, 5);
      const path = `${profile.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      // Bucket is private — store the object path and resolve a signed URL on read.
      await saveProfile({ data: { avatar_url: path } });
      await qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (err) {
      console.error(err);
      setAvatarError(t("avatar_failed"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="mx-auto max-w-md">
      <header className="px-5 pt-6 pb-4 flex items-center justify-between">
        <h1 className="text-3xl font-black text-foreground">{t("profile")}</h1>
        <button
          onClick={handleSignOut}
          className="press h-11 rounded-full bg-muted text-foreground px-4 font-bold text-xs flex items-center gap-1.5"
        >
          <LogOut className="h-4 w-4" strokeWidth={2.5} /> {t("sign_out")}
        </button>
      </header>

      {adminQ.data?.admin && (
        <div className="px-5 pb-4">
          <Link
            to="/admin"
            className="press flex items-center justify-between rounded-3xl bg-track text-track-foreground p-4 shadow-card"
          >
            <span className="font-black text-sm">{t("admin_payments")}</span>
            <ChevronRight className="h-5 w-5" strokeWidth={3} />
          </Link>
        </div>
      )}



      <div className="px-5">
        <div className="rounded-3xl bg-primary text-primary-foreground p-5 flex items-center gap-4 shadow-chunky">
          <div className="relative">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt=""
                className="h-16 w-16 rounded-full object-cover ring-2 ring-amber"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-amber flex items-center justify-center text-amber-foreground">
                <User className="h-7 w-7" strokeWidth={2.5} />
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-amber text-amber-foreground flex items-center justify-center shadow-md press"
              aria-label={t("change_avatar")}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" strokeWidth={2.5} />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-extrabold truncate">{displayName}</p>
            <p className="text-xs text-primary-foreground/70 font-semibold truncate">
              {profile?.phone ?? (profile?.telegram_username ? `@${profile.telegram_username}` : t("add_phone_hint"))}
            </p>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="h-11 w-11 rounded-full bg-amber text-amber-foreground flex items-center justify-center press"
            aria-label={t("edit_profile")}
          >
            <Pencil className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>
        {avatarError && (
          <p className="mt-2 text-xs font-bold text-tomato text-center">{avatarError}</p>
        )}
      </div>

      {profile && (
        <section className="px-5 mt-6">
          <h2 className="text-xs font-extrabold uppercase text-foreground/60 tracking-wide mb-3">
            {t("telegram_notifications")}
          </h2>
          <TelegramCard profile={profile} />
        </section>
      )}

      <section className="px-5 mt-6">
        <h2 className="text-xs font-extrabold uppercase text-foreground/60 tracking-wide mb-3">
          {t("order_history")}
        </h2>
        {ordersQ.isLoading ? (
          <div className="rounded-3xl bg-muted p-6 text-center text-sm font-semibold text-muted-foreground">
            {t("loading")}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-3xl bg-muted p-6 text-center">
            <p className="text-sm text-muted-foreground font-semibold">{t("no_orders")}</p>
            <Link
              to="/"
              className="mt-3 inline-block rounded-full bg-primary text-primary-foreground px-5 py-2.5 font-bold text-sm press"
            >
              {t("order_now")}
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {orders.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </div>
        )}
      </section>

      {editing && profile && (
        <EditProfile
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={async (savedLang) => {
            if (savedLang) setLang(savedLang);
            await qc.invalidateQueries({ queryKey: ["profile"] });
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}

function OrderRow({ order }: { order: OrderRow }) {
  const { t } = useT();
  const Icon =
    order.status === "delivered"
      ? PackageCheck
      : order.status === "on_the_way"
        ? Bike
        : order.status === "cooking"
          ? ChefHat
          : Check;
  const label =
    order.status === "delivered"
      ? t("delivered")
      : order.status === "on_the_way"
        ? t("on_the_way")
        : order.status === "cooking"
          ? t("cooking")
          : t("order_placed");
  const itemsCount = Array.isArray(order.items) ? order.items.length : 0;
  return (
    <Link
      to="/order/$id"
      params={{ id: order.id }}
      className="press block rounded-3xl bg-surface shadow-card p-4 flex items-center gap-3"
    >
      <div className="h-11 w-11 rounded-2xl bg-muted flex items-center justify-center">
        <Icon className="h-5 w-5 text-foreground" strokeWidth={2.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-extrabold text-foreground">#{order.id.slice(0, 6).toUpperCase()}</p>
          <span className="text-[10px] font-black uppercase text-amber-foreground bg-amber px-2 py-0.5 rounded-full">
            {label}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground font-semibold">
          {t("items_count").replace("{n}", String(itemsCount))} · {formatUZS(order.total)}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 text-foreground/40" />
    </Link>
  );
}

function EditProfile({
  profile,
  onClose,
  onSaved,
}: {
  profile: ProfileRow;
  onClose: () => void;
  onSaved: (lang?: Lang) => void | Promise<void>;
}) {
  const { t } = useT();
  const saveProfile = useServerFn(updateMyProfile);
  const mut = useMutation({
    mutationFn: (values: Record<string, unknown>) => saveProfile({ data: values as any }),
    onSuccess: (_data, variables) => onSaved((variables as any).language as Lang),
  });

  const [form, setForm] = useState({
    username: profile.username ?? "",
    first_name: profile.first_name ?? "",
    last_name: profile.last_name ?? "",
    phone: profile.phone ?? "",
    address: profile.address ?? "",
    language: (profile.language as "uz" | "ru") ?? "uz",
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const phoneOk = form.phone.trim() === "" || form.phone.replace(/\D/g, "").length <= 3 || isValidUzPhone(form.phone);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneOk) return;
    mut.mutate({
      username: form.username || null,
      first_name: form.first_name || null,
      last_name: form.last_name || null,
      phone: form.phone.replace(/\D/g, "").length > 3 ? form.phone : null,
      address: form.address || null,
      language: form.language,
    });
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-primary-foreground/70 flex items-end sm:items-center justify-center">
      <div className="w-full max-w-md bg-background rounded-t-[2rem] sm:rounded-3xl shadow-chunky max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-background px-5 pt-5 pb-3 flex items-center justify-between border-b border-foreground/5">
          <h2 className="text-xl font-black text-foreground">{t("edit_profile")}</h2>
          <button onClick={onClose} className="h-10 w-10 rounded-full bg-muted flex items-center justify-center press">
            <X className="h-5 w-5 text-foreground" strokeWidth={2.5} />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <Field label={t("username")}>
            <input
              value={form.username}
              onChange={(e) => set("username", e.target.value)}
              placeholder="oshfan98"
              className="input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("first_name")}>
              <input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} className="input" />
            </Field>
            <Field label={t("last_name")}>
              <input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} className="input" />
            </Field>
          </div>
          <Field label={t("phone")}>
            <input
              type="tel"
              inputMode="numeric"
              value={form.phone}
              onChange={(e) => set("phone", formatUzPhone(e.target.value))}
              placeholder="+998 90 123 45 67"
              aria-invalid={form.phone.length > 5 && !isValidUzPhone(form.phone)}
              className="input"
            />
            {form.phone.length > 5 && !isValidUzPhone(form.phone) && (
              <p className="mt-1.5 text-[11px] font-bold text-tomato">{t("phone_hint")}</p>
            )}
          </Field>
          <Field label={t("delivery_address")}>
            <textarea
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              rows={3}
              placeholder={t("address_placeholder")}
              className="input resize-none"
            />
          </Field>
          <Field label={t("language")}>
            <div className="grid grid-cols-2 gap-2">
              {(["uz", "ru"] as const).map((code) => (
                <button
                  type="button"
                  key={code}
                  onClick={() => set("language", code)}
                  className={`press rounded-2xl py-3 text-sm font-black uppercase ${
                    form.language === code ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
          </Field>
          {mut.isError && (
            <p className="text-sm text-tomato font-bold">{(mut.error as Error).message}</p>
          )}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="press flex-1 rounded-full bg-muted text-foreground py-4 font-black"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={mut.isPending || !phoneOk}
              className="press flex-1 rounded-full bg-primary text-primary-foreground py-4 font-black shadow-chunky disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("save")}
            </button>
          </div>
        </form>
      </div>
      <style>{`.input{width:100%;border-radius:1rem;background:var(--muted);border:1px solid var(--border);padding:14px 16px;color:var(--foreground);font-weight:600;outline:none;caret-color:var(--amber)}.input::placeholder{color:color-mix(in oklab, var(--foreground) 45%, transparent);font-weight:600}.input:focus{border-color:var(--amber);box-shadow:0 0 0 2px var(--amber)}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-extrabold text-foreground/60 uppercase tracking-wide">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}


function TelegramCard({ profile }: { profile: ProfileRow }) {
  const { t } = useT();
  const qc = useQueryClient();
  const saveProfile = useServerFn(updateMyProfile);
  const sendTest = useServerFn(sendTelegramTestNotification);
  const linked = Boolean(profile.telegram_chat_id);
  const enabled = profile.notifications_enabled !== false;
  const [status, setStatus] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const toggle = useMutation({
    mutationFn: () => saveProfile({ data: { notifications_enabled: !enabled } }),
    onSuccess: async () => {
      tgHaptic("light");
      setStatus(null);
      await qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  const test = useMutation({
    mutationFn: () => sendTest(),
    onSuccess: (res) => {
      if (res && res.ok === false) {
        tgHaptic("warning");
        setStatus({ tone: "bad", text: res.reason ?? t("tg_test_unavailable") });
        return;
      }
      tgHaptic("success");
      setStatus({ tone: "ok", text: t("test_sent") });
    },

    onError: (e: Error) => {
      tgHaptic("warning");
      setStatus({ tone: "bad", text: e.message });
    },
  });

  return (
    <div className="rounded-3xl bg-surface shadow-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div
          className={`h-11 w-11 rounded-2xl flex items-center justify-center ${
            linked && enabled ? "bg-[#2AABEE] text-white" : "bg-muted text-foreground"
          }`}
        >
          {linked && enabled ? (
            <Bell className="h-5 w-5" strokeWidth={2.5} />
          ) : (
            <BellOff className="h-5 w-5" strokeWidth={2.5} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold text-foreground">
            {linked ? (enabled ? t("notif_on") : t("notif_paused")) : t("tg_not_linked")}
          </p>
          <p className="text-[11px] text-muted-foreground font-semibold">
            {linked ? t("notif_on_sub") : t("tg_not_linked_sub")}
          </p>
        </div>
        {linked && (
          <button
            onClick={() => toggle.mutate()}
            disabled={toggle.isPending}
            role="switch"
            aria-checked={enabled}
            aria-label={t("toggle_notifications")}
              className={`relative h-7 w-12 rounded-full transition-colors press ${
              enabled ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-surface shadow-md transition-all ${
                enabled ? "left-6" : "left-1"
              }`}
            />
          </button>
        )}
      </div>

      {linked && (
        <button
          onClick={() => test.mutate()}
          disabled={test.isPending || !enabled}
          className="press w-full rounded-2xl bg-muted text-foreground py-3 text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {test.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" strokeWidth={2.5} />}
          {t("send_test")}
        </button>
      )}

      {status && (
        <p className={`text-xs font-bold ${status.tone === "ok" ? "text-foreground" : "text-tomato"}`}>{status.text}</p>
      )}
    </div>
  );
}


/** Resolves a signed URL for an avatar stored in the private "avatars" bucket. */
function useAvatarUrl(pathOrUrl: string | null) {
  const { data } = useQuery({
    queryKey: ["avatar-url", pathOrUrl],
    enabled: Boolean(pathOrUrl),
    staleTime: 30 * 60_000,
    queryFn: async () => {
      if (!pathOrUrl) return null;
      if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
      const { data, error } = await supabase.storage
        .from("avatars")
        .createSignedUrl(pathOrUrl, 60 * 60);
      if (error) return null;
      return data.signedUrl;
    },
  });
  return data ?? null;
}
