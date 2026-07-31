import { useEffect, useMemo, useState } from "react";
import { Check, Minus, Plus, X } from "lucide-react";
import { motion } from "framer-motion";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import {
  computeUnitPrice,
  defaultSelection,
  getProductConfig,
  selectionKey,
  type Selection,
} from "@/lib/customization";
import { productDescription, productName, type Pizza } from "@/lib/pizzas";
import { formatUZS } from "@/lib/format";
import { useStore } from "@/lib/store";
import { tgHaptic } from "@/lib/telegram";
import { useT } from "@/lib/i18n";

export function ProductCustomizer({
  product,
  open,
  onOpenChange,
}: {
  product: Pizza | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, lang } = useT();
  const addToCart = useStore((s) => s.addToCart);

  const config = useMemo(
    () => (product ? getProductConfig(product) : null),
    [product],
  );
  const [selection, setSelection] = useState<Selection>({
    sizeId: "",
    comboId: "",
    extraIds: [],
  });
  const [qty, setQty] = useState(1);

  // Reset the form each time a different product is opened.
  useEffect(() => {
    if (!config) return;
    setSelection(defaultSelection(config));
    setQty(1);
  }, [config]);

  const unit = useMemo(
    () => (product && config ? computeUnitPrice(product, config, selection) : 0),
    [product, config, selection],
  );

  if (!product || !config) return null;

  const sizeLabel = selection.sizeId ? t(`size_${selection.sizeId}`) : "";
  const comboLabel = selection.comboId ? t(`crust_${selection.comboId}`) : "";

  const toggleExtra = (id: string) => {
    tgHaptic("light");
    setSelection((prev) => ({
      ...prev,
      extraIds: prev.extraIds.includes(id)
        ? prev.extraIds.filter((x) => x !== id)
        : [...prev.extraIds, id],
    }));
  };

  const handleAdd = () => {
    tgHaptic("success");
    addToCart({
      key: selectionKey(product.id, selection),
      pizzaId: product.id,
      name: productName(product, lang),
      image: product.image,
      size: selection.sizeId,
      sizeLabel,
      crust: selection.comboId,
      crustLabel: comboLabel,
      toppings: selection.extraIds,
      unitPrice: unit,
      qty,
    });
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md overflow-hidden border-none bg-background p-0">
        <div className="scroll-slim max-h-[74vh] overflow-y-auto overscroll-contain px-5 pb-44 pt-1">
          {/* Header */}
          <div className="flex items-start gap-4">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 14 }}
              className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-3xl bg-muted"
            >
              <img
                src={product.image}
                alt={productName(product, lang)}
                width={256}
                height={256}
                className="h-full w-full object-cover"
              />
            </motion.div>

            <div className="min-w-0 flex-1 pt-0.5">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                {t(`cat_${product.category}`)}
              </span>
              <DrawerTitle className="mt-1 text-lg font-black leading-tight text-foreground">
                {productName(product, lang)}
              </DrawerTitle>
              <DrawerDescription className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-muted-foreground">
                {productDescription(product, lang)}
              </DrawerDescription>
            </div>

            <DrawerClose className="press flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
              <X className="h-4 w-4" strokeWidth={3} />
            </DrawerClose>
          </div>

          {/* Sizes */}
          {config.sizes.length > 0 && (
            <section className="mt-7">
              <SectionTitle>{t("size")}</SectionTitle>
              <div className="grid grid-cols-3 gap-2.5">
                {config.sizes.map((s) => {
                  const active = selection.sizeId === s.id;
                  const delta = Math.round(product.basePrice * (s.multiplier - 1));
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        tgHaptic("light");
                        setSelection((prev) => ({ ...prev, sizeId: s.id }));
                      }}
                      className={`press flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 py-3 text-center transition-colors ${
                        active
                          ? "border-amber bg-amber text-amber-foreground shadow-card"
                          : "border-border bg-surface text-foreground"
                      }`}
                    >
                      <span className="text-[13px] font-black uppercase leading-none">
                        {t(`size_${s.id}`)}
                      </span>
                      <span
                        className={`text-[10px] font-bold leading-none ${active ? "opacity-75" : "text-muted-foreground"}`}
                      >
                        {delta === 0
                          ? t("free")
                          : `${delta > 0 ? "+" : "−"}${formatUZS(Math.abs(delta))}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Combos */}
          {config.combos.length > 0 && (
            <section className="mt-7">
              <SectionTitle>{t("crust")}</SectionTitle>
              <div className="space-y-2.5">
                {config.combos.map((c) => {
                  const active = selection.comboId === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        tgHaptic("light");
                        setSelection((prev) => ({ ...prev, comboId: c.id }));
                      }}
                      className={`press flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left transition-colors ${
                        active
                          ? "border-amber bg-amber text-amber-foreground shadow-card"
                          : "border-border bg-surface text-foreground"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                          active ? "border-amber-foreground" : "border-border"
                        }`}
                      >
                        {active && (
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-foreground" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-extrabold">
                        {t(`crust_${c.id}`)}
                      </span>
                      <span
                        className={`flex-shrink-0 text-xs font-black ${active ? "opacity-75" : "text-muted-foreground"}`}
                      >
                        {c.extra > 0 ? `+${formatUZS(c.extra)}` : t("free")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Extras */}
          {config.extras.length > 0 && (
            <section className="mt-7">
              <SectionTitle>{t("add_toppings")}</SectionTitle>
              <div className="overflow-hidden rounded-2xl border-2 border-border bg-surface">
                {config.extras.map((e, i) => {
                  const active = selection.extraIds.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      onClick={() => toggleExtra(e.id)}
                      className={`press flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                        i > 0 ? "border-t border-border" : ""
                      } ${active ? "bg-amber/10" : ""}`}
                    >
                      <span
                        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${
                          active
                            ? "border-amber bg-amber text-amber-foreground"
                            : "border-border bg-background"
                        }`}
                      >
                        {active && <Check className="h-3.5 w-3.5" strokeWidth={4} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">
                        {t(`top_${e.id}`)}
                      </span>
                      <span className="flex-shrink-0 text-xs font-black text-muted-foreground">
                        +{formatUZS(e.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Sticky action bar with live total */}
        <div className="safe-b absolute inset-x-0 bottom-0 border-t border-border bg-background/95 px-5 pb-4 pt-4 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full border-2 border-border bg-surface p-1.5">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                aria-label="-"
                disabled={qty <= 1}
                className="press flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground disabled:opacity-40"
              >
                <Minus className="h-4 w-4" strokeWidth={3} />
              </button>
              <span className="w-7 text-center text-base font-black tabular-nums text-foreground">
                {qty}
              </span>
              <button
                onClick={() => setQty(qty + 1)}
                aria-label="+"
                className="press flex h-9 w-9 items-center justify-center rounded-full bg-amber text-amber-foreground"
              >
                <Plus className="h-4 w-4" strokeWidth={3} />
              </button>
            </div>
            <button
              onClick={handleAdd}
              className="press flex min-w-0 flex-1 items-center justify-between gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-black text-primary-foreground shadow-chunky"
            >
              <span className="truncate">{t("add_to_cart")}</span>
              <motion.span
                key={unit * qty}
                initial={{ y: -6, opacity: 0.4 }}
                animate={{ y: 0, opacity: 1 }}
                className="flex-shrink-0 tabular-nums"
              >
                {formatUZS(unit * qty)}
              </motion.span>
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </h3>
  );
}
