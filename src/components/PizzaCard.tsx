import { useState } from "react";
import { Heart, Flame } from "lucide-react";
import { motion } from "framer-motion";
import { productName, productDescription, type Pizza } from "@/lib/pizzas";
import { formatUZS } from "@/lib/format";
import { useStore } from "@/lib/store";
import { tgHaptic } from "@/lib/telegram";
import { useT } from "@/lib/i18n";
import { ProductCustomizer } from "@/components/ProductCustomizer";

export function PizzaCard({ pizza, index = 0 }: { pizza: Pizza; index?: number }) {
  const { t, lang } = useT();
  const fav = useStore((s) => s.favorites.includes(pizza.id));
  const toggle = useStore((s) => s.toggleFavorite);
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35, ease: "easeOut" }}
    >
      <button
        type="button"
        onClick={() => {
          tgHaptic("light");
          setOpen(true);
        }}
        className="press block w-full text-left rounded-3xl bg-surface shadow-card overflow-hidden tap"
      >
        <div className="relative aspect-square bg-muted overflow-hidden">
          <img
            src={pizza.image}
            alt={productName(pizza, lang)}
            loading="lazy"
            width={512}
            height={512}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              tgHaptic("light");
              toggle(pizza.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                toggle(pizza.id);
              }
            }}
            className="absolute top-2.5 right-2.5 z-10 h-9 w-9 rounded-full bg-surface/95 backdrop-blur flex items-center justify-center press"
            aria-label={t("favorites_title")}
          >
            <Heart className={`h-4 w-4 ${fav ? "fill-tomato text-tomato" : "text-foreground/70"}`} strokeWidth={2.5} />
          </span>

          {pizza.spicy && (
            <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 rounded-full bg-tomato text-white px-2 py-1 text-[10px] font-black">
              <Flame className="h-3 w-3" /> {t("badge_hot")}
            </div>
          )}
        </div>

        <div className="p-3">
          <h3 className="text-sm font-extrabold leading-tight text-foreground line-clamp-1">{productName(pizza, lang)}</h3>
          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{productDescription(pizza, lang)}</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm font-black text-foreground">{formatUZS(pizza.basePrice)}</span>
            <span className="h-9 w-9 rounded-full bg-primary text-primary-foreground text-xl font-bold flex items-center justify-center pb-0.5">+</span>
          </div>
        </div>
      </button>

      <ProductCustomizer product={pizza} open={open} onOpenChange={setOpen} />
    </motion.div>
  );
}
