import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, cartTotal } from "@/lib/store";
import { formatUZS } from "@/lib/format";
import { tgHaptic } from "@/lib/telegram";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Savat / Корзина — Bay Bay Food" },
      { name: "description", content: "Buyurtmangizni tekshiring. Проверьте заказ перед оформлением." },
      { property: "og:title", content: "Savat / Корзина — Bay Bay Food" },
      { property: "og:description", content: "Buyurtmangizni tekshiring. Проверьте заказ." },
    ],
  }),
  component: Cart,
});

function Cart() {
  const { t } = useT();
  const cart = useStore((s) => s.cart);
  const setQty = useStore((s) => s.setQty);
  const remove = useStore((s) => s.removeFromCart);
  const subtotal = cartTotal(cart);
  const delivery = cart.length === 0 || subtotal >= 150000 ? 0 : 15000;
  const total = subtotal + delivery;

  return (
    <div className="mx-auto max-w-md">
      <header className="px-5 pt-6 pb-4 flex items-center gap-3">
        <Link to="/" className="h-11 w-11 rounded-full bg-surface shadow-card flex items-center justify-center press">
          <ArrowLeft className="h-5 w-5 text-foreground" strokeWidth={2.5} />
        </Link>
        <h1 className="text-2xl font-black text-foreground">{t("cart_title")}</h1>
      </header>

      {cart.length === 0 ? (
        <div className="px-5 py-20 text-center">
          <div className="mx-auto h-24 w-24 rounded-full bg-muted flex items-center justify-center">
            <ShoppingBag className="h-10 w-10 text-foreground/50" strokeWidth={2} />
          </div>
          <h2 className="mt-5 text-xl font-black text-foreground">{t("cart_empty")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("cart_empty_sub")}</p>
          <Link to="/" className="inline-block mt-6 rounded-full bg-primary text-primary-foreground px-6 py-3 font-bold text-sm press">
            {t("browse_menu")}
          </Link>
        </div>
      ) : (
        <>
          <div className="px-5 space-y-3">
            <AnimatePresence>
              {cart.map((item) => (
                <motion.div
                  key={item.key}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  className="rounded-3xl bg-surface shadow-card p-3 flex items-center gap-3"
                >
                  <div className="h-20 w-20 rounded-2xl bg-muted flex-shrink-0 overflow-hidden">
                    <img src={item.image} alt="" width={256} height={256} className="h-full w-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-extrabold text-foreground leading-tight line-clamp-1">{item.name}</h3>
                    <p className="text-[11px] text-muted-foreground font-semibold">
                      {[item.sizeLabel, item.crustLabel].filter(Boolean).join(" · ")}
                      {item.toppings.length > 0 && ` · +${item.toppings.length}`}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-sm font-black text-foreground">{formatUZS(item.unitPrice * item.qty)}</span>
                      <div className="flex items-center gap-1.5 bg-muted rounded-full p-1">
                        <button onClick={() => { tgHaptic("light"); setQty(item.key, item.qty - 1); }} className="h-7 w-7 rounded-full bg-surface flex items-center justify-center press">
                          <Minus className="h-3.5 w-3.5 text-foreground" strokeWidth={3} />
                        </button>
                        <span className="w-5 text-center text-sm font-black text-foreground">{item.qty}</span>
                        <button onClick={() => { tgHaptic("light"); setQty(item.key, item.qty + 1); }} className="h-7 w-7 rounded-full bg-amber flex items-center justify-center press">
                          <Plus className="h-3.5 w-3.5 text-foreground" strokeWidth={3} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => remove(item.key)} className="h-9 w-9 rounded-full flex items-center justify-center press" aria-label={t("remove")}>
                    <Trash2 className="h-4 w-4 text-tomato" strokeWidth={2.5} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Summary */}
          <div className="px-5 mt-6">
            <div className="rounded-3xl bg-muted p-5 space-y-2.5">
              <Row label={t("subtotal")} value={formatUZS(subtotal)} />
              <Row label={t("delivery")} value={delivery === 0 ? t("free") : formatUZS(delivery)} />
              <div className="h-px bg-foreground/10 my-1" />
              <Row label={t("total")} value={formatUZS(total)} bold />
            </div>
          </div>

          <div className="px-5 mt-6">
            <Link
              to="/checkout"
              className="press block rounded-full bg-primary text-primary-foreground py-4 font-black text-center shadow-chunky text-sm"
            >
              {t("continue_checkout")} · {formatUZS(total)}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`${bold ? "text-base font-black text-foreground" : "text-sm font-semibold text-foreground/70"}`}>{label}</span>
      <span className={`${bold ? "text-lg font-black text-foreground" : "text-sm font-bold text-foreground"}`}>{value}</span>
    </div>
  );
}
