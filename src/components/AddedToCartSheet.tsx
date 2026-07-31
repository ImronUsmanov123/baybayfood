import { useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ShoppingBag, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";

const AUTO_DISMISS_MS = 6000;

/**
 * Interactive confirmation shown right after "Savatga" so the user is never
 * stranded on the product screen: it summarises what was added and offers a
 * one-tap route to the cart.
 */
export function AddedToCartSheet() {
  const { t } = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lastAdded = useStore((s) => s.lastAdded);
  const dismiss = useStore((s) => s.dismissLastAdded);

  // Nothing to confirm once the user is already looking at the cart/checkout.
  const onCartLikeScreen =
    pathname.startsWith("/cart") || pathname.startsWith("/checkout") || pathname.startsWith("/order/");

  useEffect(() => {
    if (lastAdded && onCartLikeScreen) dismiss();
  }, [lastAdded, onCartLikeScreen, dismiss]);

  useEffect(() => {
    if (!lastAdded) return;
    const id = window.setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [lastAdded, dismiss]);

  const visible = Boolean(lastAdded) && !onCartLikeScreen;

  return (
    <AnimatePresence>
      {visible && lastAdded && (
        <motion.div
          key={lastAdded.id}
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 bottom-24 z-50 px-4 safe-b"
        >
          <div className="mx-auto max-w-md rounded-3xl bg-surface p-4 shadow-chunky ring-1 ring-border">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 flex-shrink-0">
                <div className="h-full w-full overflow-hidden rounded-2xl bg-muted">
                  <img
                    src={lastAdded.image}
                    alt={lastAdded.name}
                    width={96}
                    height={96}
                    className="h-full w-full object-cover"
                  />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-background ring-2 ring-surface">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black leading-tight text-foreground">{t("added_to_cart")}</p>
                <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">
                  {lastAdded.qty} × {lastAdded.name}
                </p>
              </div>
              <button
                type="button"
                onClick={dismiss}
                aria-label={t("close")}
                className="press flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted"
              >
                <X className="h-4 w-4 text-foreground" strokeWidth={3} />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={dismiss}
                className="press flex-shrink-0 rounded-full border-2 border-border px-4 py-3 text-xs font-black text-foreground"
              >
                {t("keep_shopping")}
              </button>
              <Link
                to="/cart"
                onClick={dismiss}
                className="press flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-xs font-black text-primary-foreground"
              >
                <ShoppingBag className="h-4 w-4 flex-shrink-0" strokeWidth={3} />
                <span className="truncate">{t("go_to_cart")}</span>
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
