import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { BottomNav } from "@/components/BottomNav";
import { initTelegram } from "@/lib/telegram";
import { I18nProvider } from "@/lib/i18n";
import { GeolocationPrompt } from "@/components/GeolocationPrompt";
import { InstallBanner } from "@/components/InstallBanner";
import { AddedToCartSheet } from "@/components/AddedToCartSheet";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-black text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-bold text-foreground">Sahifa topilmadi · Страница не найдена</h2>
        <p className="mt-2 text-sm text-muted-foreground">Bu sahifa menyuda yo'q. · Такой страницы в меню нет.</p>
        <Link to="/" className="mt-6 inline-flex rounded-full bg-primary text-primary-foreground px-6 py-3 font-bold text-sm">
          Menyuga qaytish · В меню
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold text-foreground">Nimadir xato ketdi · Что-то пошло не так</h1>
        <p className="mt-2 text-sm text-muted-foreground">Qaytadan urinib ko'ring. · Попробуйте ещё раз.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold press"
          >Qayta urinish · Повторить</button>
          <a href="/" className="rounded-full border-2 border-foreground px-5 py-2.5 text-sm font-bold press text-foreground">Bosh sahifa · На главную</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#3B1063" },
      { title: "Bay Bay Food — Fast-fud yetkazib berish" },
      { name: "description", content: "Bay Bay Food — burger, fri, hot-dog va ichimliklar. Быстрая доставка фастфуда." },
      { name: "author", content: "Bay Bay Food" },
      { property: "og:title", content: "Bay Bay Food — Fast-fud yetkazib berish" },
      { property: "og:description", content: "Bay Bay Food — burger, fri, hot-dog va ichimliklar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/icons/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,700;12..96,800;12..96,900&family=Inter:wght@400;500;600;700;800&display=swap" },
    ],
    scripts: [
      { src: "https://telegram.org/js/telegram-web-app.js", async: true },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    // The Telegram WebApp script sets CSS vars on <html> before hydration.
    <html lang="uz" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => { initTelegram(); }, []);
  useEffect(() => {
    let mounted = false;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    import("@/integrations/supabase/client").then(({ supabase }) => {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      });
      mounted = true;
      (RootComponent as any)._sub = data.subscription;
    });
    return () => {
      if (mounted) (RootComponent as any)._sub?.unsubscribe();
    };
  }, [router, queryClient]);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <div className="min-h-screen bg-background pb-28">
          <PullToRefresh />
          <Outlet />
          <BottomNav />
          <GeolocationPrompt />
          <InstallBanner />
          <AddedToCartSheet />
          <Toaster />
        </div>
      </I18nProvider>
    </QueryClientProvider>
  );
}
