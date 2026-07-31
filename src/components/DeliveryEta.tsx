import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useT } from "@/lib/i18n";
import { computeEta, type EtaOrderLike } from "@/lib/eta";

/**
 * "Delivery time" header block on the order tracking screen.
 *
 * Re-renders once a minute and whenever the order object changes, so a value
 * pushed from the Telegram admin panel (via Realtime) appears immediately.
 */
export function DeliveryEta({
  order,
  orderNumber,
}: {
  order: EtaOrderLike | null | undefined;
  orderNumber: string;
}) {
  const { t } = useT();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const eta = useMemo(
    () => computeEta(order, now, { minute: "min", delivered: t("eta_delivered") }),
    [order, now, t],
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {t("estimated_arrival")}
        </p>
        <div className="mt-0.5 min-h-9">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={eta.text}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              className="truncate text-2xl font-black leading-tight text-foreground sm:text-3xl"
            >
              {eta.text || "—"}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
      <div className="shrink-0 rounded-full bg-amber/20 px-3 py-1.5 text-xs font-black text-foreground">
        #{orderNumber}
      </div>
    </div>
  );
}
