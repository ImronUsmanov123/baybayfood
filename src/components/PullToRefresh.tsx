import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { tgHaptic } from "@/lib/telegram";

const TRIGGER = 72; // px of pull needed to fire a refresh
const MAX = 110; // px the indicator can travel

/**
 * Native-feeling pull-to-refresh. Only engages when the page is already
 * scrolled to the very top and the gesture is clearly vertical, so it never
 * fights horizontal carousels or inner scroll areas.
 */
export function PullToRefresh() {
  const qc = useQueryClient();
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const startX = useRef(0);
  const active = useRef(false);
  const armed = useRef(false);

  useEffect(() => {
    const atTop = () => window.scrollY <= 0;

    const onStart = (e: TouchEvent) => {
      if (refreshing || e.touches.length !== 1 || !atTop()) return;
      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
      active.current = false;
      armed.current = false;
    };

    const onMove = (e: TouchEvent) => {
      if (startY.current === null || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      const dx = Math.abs(e.touches[0].clientX - startX.current);
      if (dy <= 0 || dx > Math.abs(dy)) {
        if (!active.current) startY.current = null;
        return;
      }
      if (!atTop()) {
        startY.current = null;
        setPull(0);
        return;
      }
      active.current = true;
      // Resistance curve so the pull feels elastic rather than linear.
      const distance = Math.min(MAX, dy ** 0.85);
      if (!armed.current && distance >= TRIGGER) {
        armed.current = true;
        tgHaptic("light");
      }
      setPull(distance);
    };

    const onEnd = async () => {
      const distance = pull;
      startY.current = null;
      active.current = false;
      if (distance >= TRIGGER && !refreshing) {
        setRefreshing(true);
        setPull(TRIGGER);
        tgHaptic("success");
        try {
          await Promise.all([qc.refetchQueries({ type: "active" }), router.invalidate()]);
        } catch {
          /* keep the UI responsive even if a refetch fails */
        }
        setRefreshing(false);
      }
      setPull(0);
      armed.current = false;
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [pull, refreshing, qc, router]);

  const visible = pull > 4 || refreshing;
  const ready = pull >= TRIGGER || refreshing;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: Math.max(pull, refreshing ? TRIGGER : 0) - 44 }}
          exit={{ opacity: 0, y: -44 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center"
        >
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-full shadow-card transition-colors ${
              ready ? "bg-primary text-primary-foreground" : "bg-surface text-foreground"
            }`}
          >
            {refreshing ? (
              <Loader2 className="h-5 w-5 animate-spin" strokeWidth={3} />
            ) : (
              <ArrowDown
                className="h-5 w-5 transition-transform"
                strokeWidth={3}
                style={{ transform: `rotate(${Math.min(180, (pull / TRIGGER) * 180)}deg)` }}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
