import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { ArrowLeft, Phone, MessageCircle, Bike, ChefHat, PackageCheck, Check, Clock } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";
import { formatUZS } from "@/lib/format";
import { tgHaptic } from "@/lib/telegram";
import { getOrder } from "@/lib/orders.functions";
import { DeliveryEta } from "@/components/DeliveryEta";

import type { Tables } from "@/integrations/supabase/types";

type OrderRow = Tables<"orders">;
type Status =
  | "placed"
  | "cooking"
  | "on_the_way"
  | "arriving_soon"
  | "delivered"
  | "cancelled";

export const Route = createFileRoute("/_authenticated/order/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Buyurtma #${params.id.slice(0, 6).toUpperCase()} — Bay Bay Food` },
      { name: "description", content: "Buyurtmangizni real vaqtda kuzating. Отслеживайте доставку в реальном времени." },
      { property: "og:title", content: "Buyurtmangiz / Ваш заказ — Bay Bay Food" },
      { property: "og:description", content: "Buyurtmangizni real vaqtda kuzating. Отслеживайте доставку в реальном времени." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderTracking,
});

// UI step keys — "eta" is a UI-only marker between "on_the_way" and "delivered".
type StepKey = "placed" | "cooking" | "on_the_way" | "eta" | "delivered";
const STATUS_STEPS: Array<{ key: StepKey; tKey: string; Icon: any }> = [
  { key: "placed", tKey: "order_placed", Icon: Check },
  { key: "cooking", tKey: "cooking", Icon: ChefHat },
  { key: "on_the_way", tKey: "on_the_way", Icon: Bike },
  { key: "eta", tKey: "estimated_arrival", Icon: Clock },
  { key: "delivered", tKey: "delivered", Icon: PackageCheck },
];

/** Map a DB status to its UI step index. Order is strictly forward-only. */
const STATUS_INDEX: Record<Status, number> = {
  placed: 0,
  cooking: 1,
  on_the_way: 2,
  arriving_soon: 3,
  delivered: 4,
  cancelled: 0,
};

/** Map DB status + elapsed minutes to a UI step index. */
function computeStepIndex(status: Status, createdAt: string): number {
  const base = STATUS_INDEX[status] ?? 0;
  if (status === "on_the_way") {
    const elapsed = (Date.now() - new Date(createdAt).getTime()) / 60000;
    // After ~20 min on the road, surface the "arriving soon" step.
    return elapsed >= 20 ? 3 : 2;
  }
  return base;
}

function OrderTracking() {
  const { id } = Route.useParams();
  const { t } = useT();
  const qc = useQueryClient();
  const fetchOrder = useServerFn(getOrder);
  const q = useQuery({
    queryKey: ["order", id],
    queryFn: () => fetchOrder({ data: { id } }),
    refetchInterval: 15000, // realtime handles the fast path; poll as a fallback.
  });
  const order = q.data as OrderRow | null | undefined;
  const [showSuccess, setShowSuccess] = useState(true);

  useEffect(() => {
    tgHaptic("success");
    const t = setTimeout(() => setShowSuccess(false), 1600);
    return () => clearTimeout(t);
  }, []);

  // Live status updates via Realtime.
  useEffect(() => {
    const channel = supabase
      .channel(`order:${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["order", id] });
          tgHaptic("light");
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  // Progress is monotonic: a late-arriving poll can never pull the tracker
  // back to an earlier step, and "delivered" is terminal.
  const highest = useRef(0);
  const stepIndex = useMemo(() => {
    if (!order) return highest.current;
    const next = computeStepIndex(order.status as Status, order.created_at);
    highest.current = Math.max(highest.current, next);
    return highest.current;
  }, [order]);





  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-md min-h-screen flex items-center justify-center text-foreground font-bold">
        {t("order_loading")}
      </div>
    );
  }
  if (!order) throw notFound();

  return (
    <div className="mx-auto max-w-md min-h-screen bg-background">
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-primary flex items-center justify-center"
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 10, stiffness: 200 }}
                className="mx-auto h-32 w-32 rounded-full bg-amber flex items-center justify-center"
              >
                <motion.svg width="60" height="60" viewBox="0 0 60 60">
                  <motion.path
                    d="M15 32 L26 42 L46 20"
                    fill="none"
                    stroke="var(--navy)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
                  />
                </motion.svg>
              </motion.div>
              <motion.h2
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-6 text-3xl font-black text-primary-foreground"
              >
                {t("order_placed")}
              </motion.h2>
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="mt-2 text-amber font-bold"
              >
                #{order.id.slice(0, 6).toUpperCase()}
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative h-72 bg-muted overflow-hidden">
        <FakeMap status={order.status} createdAt={order.created_at} />
        <Link
          to="/"
          className="absolute top-6 left-5 h-11 w-11 rounded-full bg-surface shadow-card flex items-center justify-center press z-10"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" strokeWidth={2.5} />
        </Link>
      </div>

      <div className="relative -mt-8 rounded-t-[2.5rem] bg-background pt-6 pb-32 px-5 shadow-[0_-20px_40px_-20px_rgba(15,26,60,0.15)]">
        <div className="mx-auto h-1.5 w-12 rounded-full bg-foreground/15 mb-5" />

        <DeliveryEta order={order} orderNumber={order.id.slice(0, 6).toUpperCase()} />


        <div className="mt-6 space-y-3">
          {STATUS_STEPS.map((step, i) => {
            const active = i <= stepIndex;
            const current = i === stepIndex && order.status !== "delivered";
            return (
              <motion.div
                key={step.key}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-center gap-3"
              >
                <div
                  className={`h-11 w-11 rounded-2xl flex items-center justify-center transition-colors ${
                    current
                      ? "bg-brand text-brand-foreground shadow-[0_0_0_4px_rgba(15,237,234,0.25)] animate-pulse"
                      : active
                        ? "bg-brand text-brand-foreground"
                        : "bg-muted text-foreground/40"
                  }`}
                >
                  <step.Icon className="h-5 w-5" strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                  <p className={`font-extrabold ${active ? "text-foreground" : "text-foreground/40"}`}>{t(step.tKey)}</p>
                  {current && <p className="text-xs text-tomato font-bold">{t("in_progress")}</p>}
                </div>
                {active && !current && <Check className="h-5 w-5 text-foreground" strokeWidth={3} />}
              </motion.div>
            );
          })}
        </div>

        {order.status !== "delivered" && (
          <div className="mt-6 rounded-3xl bg-surface shadow-card p-4 flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-amber flex items-center justify-center font-black text-amber-foreground">
              SB
            </div>
            <div className="flex-1">
              <p className="text-sm font-extrabold text-foreground">Sherzod B.</p>
              <p className="text-[11px] text-muted-foreground font-semibold">{t("your_courier")}</p>
            </div>
            <a
              href="sms:+998900000000"
              className="h-11 w-11 rounded-full bg-muted flex items-center justify-center press"
            >
              <MessageCircle className="h-5 w-5 text-foreground" strokeWidth={2.5} />
            </a>
            <a
              href="tel:+998900000000"
              className="h-11 w-11 rounded-full bg-navy flex items-center justify-center press ring-2 ring-white/20"
            >
              <Phone className="h-5 w-5 text-white" fill="currentColor" strokeWidth={2} />
            </a>
          </div>
        )}

        <div className="mt-4 rounded-3xl bg-muted p-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground/70">
            {t("total_paid", { method: paymentLabel(order.payment_method as any, t) })}
          </span>
          <span className="text-lg font-black text-foreground">{formatUZS(order.total)}</span>
        </div>
      </div>
    </div>
  );
}

function paymentLabel(m: string, t: (k: string) => string) {
  return m === "click" ? "Click" : m === "payme" ? "Payme" : t("pay_cash");
}

const COURIER_PATH = "M 60 220 Q 180 150 220 150 T 350 90";

/** Continuous 0-1 delivery progress derived from order status + elapsed time. */
function computeProgress(status: string, createdAt: number, now: number) {
  if (status === "delivered") return 1;
  if (status === "cancelled") return 0.05;
  const elapsed = (now - createdAt) / 60000;
  const base =
    status === "placed"
      ? 0.05 + Math.min(elapsed / 10, 1) * 0.15
      : status === "cooking"
        ? 0.2 + Math.min(elapsed / 20, 1) * 0.3
        : 0.5 + Math.min(Math.max(elapsed - 20, 0) / 15, 1) * 0.45;
  return Math.min(0.98, Math.max(0.05, base));
}

/**
 * Courier marker animation.
 *
 * The whole animation lives in one requestAnimationFrame loop that writes
 * straight to the DOM node — no React state per frame, so the page never
 * re-renders while the marker moves. Progress is recomputed from the clock on
 * every frame and eased with frame-rate-independent exponential smoothing, so
 * the marker glides identically at 60 Hz and 120 Hz. The loop pauses when the
 * tab is hidden and honours `prefers-reduced-motion`.
 */
function useCourierPosition(status: string, createdAt: string) {
  const ref = useRef<SVGGElement | null>(null);
  const startedAt = useMemo(() => new Date(createdAt).getTime(), [createdAt]);
  const current = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const paint = (value: number) => {
      const node = ref.current;
      if (!node) return;
      const clamped = Math.min(1, Math.max(0, value));
      node.style.offsetDistance = `${(clamped * 100).toFixed(3)}%`;
    };

    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (current.current === null || !Number.isFinite(current.current)) {
      current.current = computeProgress(status, startedAt, Date.now());
    }
    paint(current.current);

    if (reduceMotion) {
      const id = window.setInterval(() => {
        current.current = computeProgress(status, startedAt, Date.now());
        paint(current.current);
      }, 5000);
      return () => window.clearInterval(id);
    }

    let last = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const target = computeProgress(status, startedAt, Date.now());
      const value = current.current ?? target;
      const delta = target - value;
      // ~2.5 units of catch-up per second, clamped against tab-switch jumps.
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      current.current = Math.abs(delta) < 0.0002 ? target : value + delta * (1 - Math.exp(-2.5 * dt));
      paint(current.current);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);

    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        cancelAnimationFrame(frame);
        return;
      }
      last = performance.now();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(step);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [status, startedAt]);

  return ref;
}

function FakeMap({ status, createdAt }: { status: string; createdAt: string }) {
  const courierRef = useCourierPosition(status, createdAt);

  return (
    <svg viewBox="0 0 400 288" className="absolute inset-0 h-full w-full">
      <defs>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="400" height="288" fill="url(#grid)" />
      <path d="M -20 200 Q 100 180 200 190 T 420 160" stroke="rgba(255,255,255,0.12)" strokeWidth="18" fill="none" strokeLinecap="round" />
      <path d="M 60 -20 Q 80 100 140 160 T 220 300" stroke="rgba(255,255,255,0.1)" strokeWidth="14" fill="none" strokeLinecap="round" />
      <path d="M 40 60 L 380 80" stroke="rgba(255,255,255,0.08)" strokeWidth="10" fill="none" strokeLinecap="round" />
      <path d={COURIER_PATH} stroke="rgba(255,255,255,0.25)" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d={COURIER_PATH} stroke="var(--amber)" strokeWidth="5" fill="none" strokeDasharray="8 6" strokeLinecap="round">
        <animate attributeName="stroke-dashoffset" from="28" to="0" dur="1.2s" repeatCount="indefinite" />
      </path>
      <circle cx="60" cy="220" r="10" fill="var(--navy)" />
      <circle cx="60" cy="220" r="4" fill="var(--amber)" />
      <circle cx="350" cy="90" r="12" fill="var(--tomato)" />
      <circle cx="350" cy="90" r="5" fill="white" />
      <g
        ref={courierRef}
        style={
          {
            offsetPath: `path('${COURIER_PATH}')`,
            offsetRotate: "0deg",
            willChange: "offset-distance",
          } as CSSProperties
        }
      >
        <circle r="18" fill="var(--amber)" opacity="0.25">
          <animate attributeName="r" values="14;20;14" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle r="14" fill="var(--navy)" stroke="white" strokeWidth="2" />
        <circle r="6" fill="var(--amber)" />
      </g>
    </svg>
  );
}
