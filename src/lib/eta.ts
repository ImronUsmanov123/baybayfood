/**
 * Delivery ETA logic, kept separate from the UI so the Telegram admin panel can
 * later push an authoritative ETA without touching the presentation layer.
 *
 * Priority order:
 *   1. `eta_text`            — free-form text set by an admin (wins over everything)
 *   2. `estimated_arrival_at`— absolute timestamp, rendered as remaining minutes
 *   3. `eta_minutes`         — total minutes promised at order time
 *   4. local estimate        — 30 min default countdown from `created_at`
 *
 * Fields 1-3 do not exist on the orders table yet; they are read defensively so
 * that adding them later requires no component changes.
 */

export type EtaSource = "admin" | "estimate";

export type EtaOrderLike = {
  created_at: string;
  status: string;
  eta_text?: string | null;
  eta_minutes?: number | null;
  estimated_arrival_at?: string | null;
};

export type EtaResult = {
  /** Ready-to-render value, e.g. "20–25 min". Empty while unknown. */
  text: string;
  /** Whether the value came from the admin panel or a local estimate. */
  source: EtaSource;
  /** True once the order is delivered. */
  delivered: boolean;
};

const DEFAULT_TOTAL_MINUTES = 30;
const WINDOW_MINUTES = 5;

function minutesRange(remaining: number, minuteLabel: string): string {
  const low = Math.max(5, Math.round(remaining));
  const high = low + WINDOW_MINUTES;
  return `${low}–${high} ${minuteLabel}`;
}

export function computeEta(
  order: EtaOrderLike | null | undefined,
  now: number,
  labels: { minute: string; delivered: string },
): EtaResult {
  if (!order) return { text: "", source: "estimate", delivered: false };

  if (order.status === "delivered") {
    return { text: labels.delivered, source: "estimate", delivered: true };
  }

  const adminText = order.eta_text?.trim();
  if (adminText) return { text: adminText, source: "admin", delivered: false };

  if (order.estimated_arrival_at) {
    const remaining = (new Date(order.estimated_arrival_at).getTime() - now) / 60000;
    return { text: minutesRange(remaining, labels.minute), source: "admin", delivered: false };
  }

  const total =
    typeof order.eta_minutes === "number" && order.eta_minutes > 0
      ? order.eta_minutes
      : DEFAULT_TOTAL_MINUTES;
  const elapsed = (now - new Date(order.created_at).getTime()) / 60000;
  return {
    text: minutesRange(total - elapsed, labels.minute),
    source: typeof order.eta_minutes === "number" ? "admin" : "estimate",
    delivered: false,
  };
}
