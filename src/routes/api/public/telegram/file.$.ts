import { createFileRoute } from "@tanstack/react-router";

// Public proxy for Telegram file downloads referenced by an admin broadcast
// notification. Keeps the bot token server-side and prevents arbitrary
// enumeration by requiring the path to appear in a stored notification.
export const Route = createFileRoute("/api/public/telegram/file/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const splat = (params as { _splat?: string })._splat ?? "";
        if (!splat || splat.includes("..")) return new Response("Bad path", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const key = `tg:${splat}`;
        const { data } = await supabaseAdmin
          .from("notifications")
          .select("id")
          .eq("image_url", key)
          .limit(1)
          .maybeSingle();
        if (!data) return new Response("Not found", { status: 404 });

        const tg = await import("@/lib/telegram-bot.server");
        const upstream = await tg.fetchTelegramFile(splat);
        if (!upstream) return new Response("Bot not configured", { status: 404 });
        if (!upstream.ok || !upstream.body) {
          return new Response("Upstream error", { status: upstream.status || 502 });
        }

        const headers = new Headers();
        const ct = upstream.headers.get("content-type");
        if (ct) headers.set("content-type", ct);
        headers.set("cache-control", "public, max-age=3600");
        return new Response(upstream.body, { status: 200, headers });
      },
    },
  },
});
