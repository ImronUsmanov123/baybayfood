import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Heart, Minus, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { getPizza, productName, productDescription } from "@/lib/pizzas";
import { computeUnitPrice, defaultSelection, getProductConfig, selectionKey } from "@/lib/customization";
import { formatUZS } from "@/lib/format";
import { useStore } from "@/lib/store";
import { tgHaptic } from "@/lib/telegram";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/pizza/$id")({
  head: ({ params }) => {
    const p = getPizza(params.id);
    const title = p ? `${p.nameRu} — Bay Bay Food` : "Bay Bay Food";
    const desc = p?.descriptionRu ?? "Fast-fud yetkazib berish — Bay Bay Food.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: Details,
  notFoundComponent: () => <PizzaNotFound />,
});

function PizzaNotFound() {
  const { t } = useT();
  return <div className="p-8 text-center text-foreground">{t("pizza_not_found")}</div>;
}

function Details() {
  const { t, lang } = useT();
  const { id } = Route.useParams();
  const pizza = getPizza(id);
  const navigate = useNavigate();
  const fav = useStore((s) => pizza && s.favorites.includes(pizza.id));
  const toggleFav = useStore((s) => s.toggleFavorite);
  const addToCart = useStore((s) => s.addToCart);

  const config = useMemo(
    () => (pizza ? getProductConfig(pizza) : { sizes: [], combos: [], extras: [] }),
    [pizza],
  );
  const [selection, setSelection] = useState(() => defaultSelection(config));
  const [qty, setQty] = useState(1);

  const unit = useMemo(
    () => (pizza ? computeUnitPrice(pizza, config, selection) : 0),
    [pizza, config, selection],
  );

  if (!pizza) return null;

  const sizeLabel = selection.sizeId ? t(`size_${selection.sizeId}`) : "";
  const comboLabel = selection.comboId ? t(`crust_${selection.comboId}`) : "";

  const toggleTop = (id: string) =>
    setSelection((prev) => ({
      ...prev,
      extraIds: prev.extraIds.includes(id)
        ? prev.extraIds.filter((x) => x !== id)
        : [...prev.extraIds, id],
    }));

  const handleAdd = () => {
    tgHaptic("success");
    addToCart({
      key: selectionKey(pizza.id, selection),
      pizzaId: pizza.id,
      name: productName(pizza, lang),
      image: pizza.image,
      size: selection.sizeId,
      sizeLabel,
      crust: selection.comboId,
      crustLabel: comboLabel,
      toppings: selection.extraIds,
      unitPrice: unit,
      qty,
    });
    navigate({ to: "/cart" });
  };

  return (
    <div className="mx-auto max-w-md pb-40">
      {/* Hero */}
      <div className="relative bg-muted pt-4 pb-8 rounded-b-[3rem] overflow-hidden">
        <div className="flex items-center justify-between px-5">
          <Link to="/" className="h-11 w-11 rounded-full bg-surface shadow-card flex items-center justify-center press">
            <ArrowLeft className="h-5 w-5 text-foreground" strokeWidth={2.5} />
          </Link>
          <button
            onClick={() => { tgHaptic("light"); toggleFav(pizza.id); }}
            className="h-11 w-11 rounded-full bg-surface shadow-card flex items-center justify-center press"
          >
            <Heart className={`h-5 w-5 ${fav ? "fill-tomato text-tomato" : "text-foreground"}`} strokeWidth={2.5} />
          </button>
        </div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", damping: 12 }}
          className="mt-4 mx-auto h-72 w-72"
        >
          <img src={pizza.image} alt={productName(pizza, lang)} width={1024} height={1024} className="h-full w-full object-contain drop-shadow-[0_30px_30px_rgba(0,0,0,0.3)]" />
        </motion.div>
      </div>

      {/* Info */}
      <div className="px-5 pt-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase">{t(`cat_${pizza.category}`)}</span>
        </div>
        <h1 className="text-3xl font-black text-foreground leading-tight">{productName(pizza, lang)}</h1>
        <p className="text-sm text-muted-foreground mt-1.5">{productDescription(pizza, lang)}</p>

        {/* Size */}
        {config.sizes.length > 0 && (
        <section className="mt-6">
          <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wide mb-3">{t("size")}</h3>
          <div className="grid grid-cols-3 gap-2">
            {config.sizes.map((s) => {
              const active = selection.sizeId === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelection((prev) => ({ ...prev, sizeId: s.id }))}
                  className={`press rounded-2xl p-4 border-2 text-center transition-all ${active ? "bg-amber border-amber text-amber-foreground" : "bg-surface border-border text-foreground/80"}`}
                >
                  <div className="text-sm font-black uppercase">{t(`size_${s.id}`)}</div>
                </button>
              );
            })}
          </div>
        </section>)}

        {/* Combo */}
        {config.combos.length > 0 && (<section className="mt-5">
          <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wide mb-3">{t("crust")}</h3>
          <div className="grid grid-cols-3 gap-2">
            {config.combos.map((c) => {
              const active = selection.comboId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelection((prev) => ({ ...prev, comboId: c.id }))}
                  className={`press rounded-2xl p-3 border-2 text-center transition-all ${active ? "bg-amber border-amber text-amber-foreground" : "bg-surface border-border text-foreground/80"}`}
                >
                  <div className="text-sm font-extrabold">{t(`crust_${c.id}`)}</div>
                  {c.extra > 0 && <div className="text-[10px] font-semibold opacity-70 mt-0.5">+{formatUZS(c.extra)}</div>}
                </button>
              );
            })}
          </div>
        </section>)}

        {/* Toppings */}
        {config.extras.length > 0 && (<section className="mt-5">
          <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wide mb-3">{t("add_toppings")}</h3>
          <div className="flex flex-wrap gap-2">
            {config.extras.map((top) => {
              const active = selection.extraIds.includes(top.id);
              return (
                <button
                  key={top.id}
                  onClick={() => toggleTop(top.id)}
                  className={`press rounded-full px-3.5 py-2 text-xs font-bold transition-all ${active ? "bg-primary text-primary-foreground" : "bg-surface text-foreground shadow-card"}`}
                >
                  {t(`top_${top.id}`)} <span className="opacity-70">+{formatUZS(top.price)}</span>
                </button>
              );
            })}
          </div>
        </section>)}

      </div>

      {/* Bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 safe-b px-5 pt-3 bg-gradient-to-t from-background via-background to-transparent">
        <div className="mx-auto max-w-md flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-surface shadow-card p-1.5">
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center press">
              <Minus className="h-4 w-4 text-foreground" strokeWidth={3} />
            </button>
            <span className="w-6 text-center text-base font-black text-foreground">{qty}</span>
            <button onClick={() => setQty(qty + 1)} className="h-9 w-9 rounded-full bg-amber flex items-center justify-center press">
              <Plus className="h-4 w-4 text-amber-foreground" strokeWidth={3} />
            </button>
          </div>
          <button
            onClick={handleAdd}
            className="press flex-1 rounded-full bg-primary text-primary-foreground py-4 font-black text-sm shadow-chunky flex items-center justify-between px-5"
          >
            <span>{t("add_to_cart")}</span>
            <span className="opacity-80">{formatUZS(unit * qty)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
