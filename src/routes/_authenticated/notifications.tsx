import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft, Bell, CheckCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyNotifications, markNotificationsRead } from "@/lib/notifications.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Bildirishnomalar / Уведомления — Bay Bay Food" },
      { name: "description", content: "Bay Bay Food yangiliklari va buyurtma holati." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Notifications,
});

function Notifications() {
  const { t } = useT();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchNotifs = useServerFn(listMyNotifications);
  const markRead = useServerFn(markNotificationsRead);

  const q = useQuery({ queryKey: ["notifications"], queryFn: () => fetchNotifs() });
  const items = q.data ?? [];

  const markAll = useMutation({
    mutationFn: () => markRead({ data: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif-page:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  return (
    <div className="mx-auto max-w-md">
      <header className="px-5 pt-6 pb-4 flex items-center gap-3">
        <Link
          to="/"
          className="h-11 w-11 rounded-full bg-surface shadow-card flex items-center justify-center press"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" strokeWidth={2.5} />
        </Link>
        <h1 className="text-2xl font-black text-foreground flex-1">{t("notifications")}</h1>
        {items.some((n: any) => !n.read_at) && (
          <button
            onClick={() => markAll.mutate()}
            className="press h-10 px-3 rounded-full bg-muted text-foreground text-xs font-bold flex items-center gap-1.5"
          >
            <CheckCheck className="h-4 w-4" strokeWidth={2.5} /> {t("mark_all_read")}
          </button>
        )}
      </header>

      <div className="px-5 space-y-3">
        {q.isLoading ? (
          <p className="text-center py-16 text-sm text-muted-foreground font-semibold">Loading…</p>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <div className="mx-auto h-24 w-24 rounded-full bg-muted flex items-center justify-center">
              <Bell className="h-10 w-10 text-foreground/40" strokeWidth={2} />
            </div>
            <p className="mt-5 text-sm font-semibold text-muted-foreground">{t("no_notifications")}</p>
          </div>
        ) : (
          items.map((n: any) => (
            <div
              key={n.id}
              className={`rounded-3xl p-4 shadow-card ${n.read_at ? "bg-muted" : "bg-surface ring-2 ring-brand"}`}
            >
              <div className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ${n.read_at ? "bg-surface" : "bg-brand"}`}>
                  <Bell className="h-5 w-5 text-foreground" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-foreground">{n.title}</p>
                  <p className="text-xs text-foreground/70 font-semibold mt-0.5 whitespace-pre-line">{n.body}</p>
                  {n.image_url && (
                    <img
                      src={notifImageSrc(n.image_url)}
                      alt=""
                      className="mt-3 rounded-2xl w-full max-h-80 object-cover"
                      loading="lazy"
                    />
                  )}
                  <p className="mt-2 text-[10px] font-bold text-foreground/40 uppercase">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function notifImageSrc(raw: string): string {
  // Broadcast images from Telegram admins are stored as "tg:<file_path>";
  // proxy them through our public route so the bot token stays server-side.
  if (raw.startsWith("tg:")) return `/api/public/telegram/file/${raw.slice(3)}`;
  return raw;
}