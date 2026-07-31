import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, MapPin, Bell, Pencil, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PIZZAS, CATEGORIES, productName } from "@/lib/pizzas";
import { PizzaCard } from "@/components/PizzaCard";
import { PromoCarousel } from "@/components/PromoCarousel";
import { useAuth } from "@/hooks/use-auth";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { listMyNotifications } from "@/lib/notifications.functions";
import { useT, useSyncLangFromProfile, type Lang } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import { supabase } from "@/integrations/supabase/client";
import { AddressOnboarding } from "@/components/AddressOnboarding";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bay Bay Food — Fast-fud yetkazib berish / Доставка фастфуда" },
      {
        name: "description",
        content:
          "Bay Bay Food: burgerlar, fri, hot-doglar va ichimliklar. Бургеры, фри, хот-доги и напитки с быстрой доставкой.",
      },
      { property: "og:title", content: "Bay Bay Food — Fast-fud yetkazib berish" },
      {
        property: "og:description",
        content: "Burgerlar, fri, hot-doglar va ichimliklar. Бургеры, фри, хот-доги и напитки.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { t, lang } = useT();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchNotifs = useServerFn(listMyNotifications);
  const saveProfile = useServerFn(updateMyProfile);
  const profileQ = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
    enabled: !!user,
  });
  const notifQ = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifs(),
    enabled: !!user,
  });
  useSyncLangFromProfile((profileQ.data?.language as Lang | undefined) ?? null);

  // Realtime for new notifications so the bell badge updates live.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const unread = (notifQ.data ?? []).filter((n: any) => !n.read_at).length;
  const address = profileQ.data?.address?.trim() || "";
  const [editingAddr, setEditingAddr] = useState(false);

  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const pizzas = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return PIZZAS.filter(
      (p) =>
        (cat === "all" || p.category === cat) &&
        (needle === "" ||
          p.name.toLowerCase().includes(needle) ||
          p.nameRu.toLowerCase().includes(needle)),
    );
  }, [cat, q]);

  return (
    <div className="mx-auto max-w-md">
      {/* Header */}
      <header className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between">
          {user ? (
            <button
              onClick={() => setEditingAddr(true)}
              className="text-left group max-w-[70%]"
              aria-label={t("edit_address")}
            >
              <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <MapPin className="h-3 w-3" /> {t("deliver_to")}
              </div>
              <p className="text-base font-extrabold text-foreground leading-tight flex items-center gap-1.5 truncate">
                <span className="truncate">{address || t("add_address")}</span>
                <Pencil className="h-3.5 w-3.5 text-foreground/50 shrink-0" strokeWidth={2.5} />
              </p>
            </button>
          ) : (
            <Link to="/auth" className="text-left max-w-[70%]" aria-label={t("edit_address")}>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <MapPin className="h-3 w-3" /> {t("deliver_to")}
              </div>
              <p className="text-base font-extrabold text-foreground leading-tight truncate">
                {t("add_address")}
              </p>
            </Link>
          )}

          <div className="flex items-center gap-2">
            <LanguageToggle />
          <Link
            to={user ? "/notifications" : "/auth"}
            className="relative h-11 w-11 rounded-full bg-surface shadow-card flex items-center justify-center press"
            aria-label={t("notifications")}
          >
            <Bell className="h-5 w-5 text-foreground" strokeWidth={2.5} />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-tomato text-white text-[10px] font-bold flex items-center justify-center">
                {unread}
              </span>
            )}
          </Link>
          </div>
        </div>

        {/* Promo carousel */}
        <PromoCarousel />

        {/* Search */}
        <div className="mt-5 flex items-center gap-2 rounded-2xl bg-surface shadow-card px-4 py-3.5">
          <Search className="h-5 w-5 text-foreground/60" strokeWidth={2.5} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search_placeholder")}
            className="flex-1 bg-transparent outline-none text-sm font-semibold text-foreground placeholder:text-muted-foreground placeholder:font-semibold"
          />
        </div>
      </header>

      {/* Categories */}
      <div className="px-5">
        <div className="flex gap-2 overflow-x-auto scroll-hide -mx-5 px-5 py-1">
          {CATEGORIES.map((c) => {
            const active = cat === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={`press shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-surface text-foreground shadow-card"}`}
              >
                <span className="text-base">{c.emoji}</span> {t(`cat_${c.id}`)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <section className="px-5 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-extrabold text-foreground">{cat === "all" ? t("all_items") : t(`cat_${cat}`)}</h2>
          <span className="text-xs font-semibold text-muted-foreground">{t("items_count", { n: pizzas.length })}</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {pizzas.map((p, i) => (
            <PizzaCard key={p.id} pizza={p} index={i} />
          ))}
        </div>
        {pizzas.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-12">{t("no_results")}</p>
        )}
      </section>

      <AnimatePresence>
        {editingAddr && user && (
          <AddressEditor
            initial={address}
            onClose={() => setEditingAddr(false)}
            onSaved={async (next) => {
              await saveProfile({ data: { address: next || null } });
              await qc.invalidateQueries({ queryKey: ["profile"] });
              setEditingAddr(false);
            }}
          />
        )}
      </AnimatePresence>

      <AddressOnboarding
        userId={user?.id}
        hasAddress={!!address}
        ready={!!user && profileQ.isSuccess && !editingAddr}
      />

    </div>
  );
}

function AddressEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: string;
  onClose: () => void;
  onSaved: (next: string) => void | Promise<void>;
}) {
  const { t } = useT();
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The profile query may resolve after the sheet opens; adopt the saved
  // address as long as the user hasn't started typing.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setValue(initial);
  }, [initial, touched]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-primary-foreground/70 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60 }}
        animate={{ y: 0 }}
        exit={{ y: 60 }}
        className="w-full max-w-md bg-background rounded-t-[2rem] sm:rounded-3xl shadow-chunky p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-black text-foreground">{t("delivery_address")}</h2>
          <button
            onClick={onClose}
            className="h-10 w-10 rounded-full bg-muted flex items-center justify-center press"
          >
            <X className="h-5 w-5 text-foreground" strokeWidth={2.5} />
          </button>
        </div>
        <textarea
          autoFocus
          value={value}
          onChange={(e) => {
            setTouched(true);
            setValue(e.target.value);
          }}
          rows={3}
          placeholder={t("address_placeholder")}
          className="w-full rounded-2xl bg-muted px-4 py-3 text-sm font-semibold text-foreground placeholder:text-foreground/40 outline-none resize-none"
        />
        {error && <p className="mt-2 text-xs font-semibold text-tomato">{error}</p>}
        <div className="mt-4 flex gap-3">
          <button
            onClick={onClose}
            className="press flex-1 rounded-full bg-muted text-foreground py-3.5 font-black"
          >
            {t("cancel")}
          </button>
          <button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                await onSaved(value.trim());
              } catch (e: any) {
                setError(e?.message ?? t("err_generic"));
              } finally {
                setSaving(false);
              }
            }}
            className="press flex-1 rounded-full bg-primary text-primary-foreground py-3.5 font-black disabled:opacity-60"
          >
            {t("save")}
          </button>
        </div>

      </motion.div>
    </motion.div>
  );
}
