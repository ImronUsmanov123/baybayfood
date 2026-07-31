import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Heart, ShoppingBag, User } from "lucide-react";
import { useStore, cartCount } from "@/lib/store";
import { useAuth } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";

const items = [
  { to: "/", key: "nav_home", Icon: Home, match: (p: string) => p === "/" },
  { to: "/favorites", key: "nav_favorites", Icon: Heart, match: (p: string) => p.startsWith("/favorites") },
  { to: "/cart", key: "nav_cart", Icon: ShoppingBag, match: (p: string) => p.startsWith("/cart") },
  { to: "/profile", key: "nav_profile", Icon: User, match: (p: string) => p.startsWith("/profile") },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const count = useStore((s) => cartCount(s.cart));
  const { user } = useAuth();
  const { t } = useT();

  if (
    pathname.startsWith("/order/") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/pizza/") ||
    pathname.startsWith("/auth")
  )
    return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 safe-b px-4 pt-2 tap">
      <div className="mx-auto max-w-md rounded-3xl bg-navy text-white shadow-chunky flex justify-around px-2 py-2">
        {items.map(({ to, key, Icon, match }) => {
          const active = match(pathname);
          const isCart = to === "/cart";
          const isProfile = to === "/profile";
          const href = isProfile && !user ? "/auth" : to;
          const label = t(key);
          return (
            <Link
              key={to}
              to={href}
              className="press flex-1 flex flex-col items-center gap-0.5 py-2 rounded-2xl relative"
            >
              <div
                className={`relative flex items-center justify-center h-9 w-9 rounded-xl transition-colors ${
                  active ? "bg-white/15 text-white" : "text-white"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={2.5} />
                {isCart && count > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-tomato text-white text-[10px] font-bold flex items-center justify-center">
                    {count}
                  </span>
                )}
                {isProfile && !user && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-tomato ring-2 ring-white" />
                )}
              </div>
              <span className="text-[10px] font-semibold text-white">
                {isProfile && !user ? t("sign_in") : label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
