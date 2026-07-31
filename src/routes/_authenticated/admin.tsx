import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Loader2, Receipt, ShieldCheck, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { formatUZS } from "@/lib/format";
import { adminListOrders, adminReviewPayment, amIAdmin, getReceiptUrl } from "@/lib/payments.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "To'lovlarni tekshirish — Bay Bay Food" },
      { name: "description", content: "Mijozlarning o'tkazmalarini tasdiqlash. Проверка переводов клиентов." },
      { property: "og:title", content: "To'lovlarni tekshirish — Bay Bay Food" },
      { property: "og:description", content: "Mijozlarning o'tkazmalarini tasdiqlash. Проверка переводов клиентов." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPayments,
});

type Filter = "pending_verification" | "approved" | "rejected" | "all";

function AdminPayments() {
  const { t } = useT();
  const qc = useQueryClient();
  const checkAdmin = useServerFn(amIAdmin);
  const list = useServerFn(adminListOrders);
  const [filter, setFilter] = useState<Filter>("pending_verification");

  const adminQ = useQuery({ queryKey: ["am-i-admin"], queryFn: () => checkAdmin() });
  const ordersQ = useQuery({
    queryKey: ["admin-orders", filter],
    queryFn: () => list({ data: { status: filter } }),
    enabled: !!adminQ.data?.admin,
  });

  if (adminQ.isLoading) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-foreground" />
      </div>
    );
  }

  if (!adminQ.data?.admin) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="font-black text-foreground">{t("admin_only")}</p>
        <Link to="/" className="mt-4 inline-block rounded-full bg-primary text-primary-foreground px-6 py-3 font-bold text-sm">
          {t("browse_menu")}
        </Link>
      </div>
    );
  }

  const tabs: Array<{ id: Filter; label: string }> = [
    { id: "pending_verification", label: t("admin_pending") },
    { id: "approved", label: t("admin_approved") },
    { id: "rejected", label: t("admin_rejected") },
    { id: "all", label: t("admin_all") },
  ];

  return (
    <div className="mx-auto max-w-md pb-28">
      <header className="px-5 pt-6 pb-4 flex items-center gap-3">
        <Link to="/profile" className="h-11 w-11 rounded-full bg-surface shadow-card flex items-center justify-center press">
          <ArrowLeft className="h-5 w-5 text-foreground" strokeWidth={2.5} />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-track" strokeWidth={2.5} />
            {t("admin_payments")}
          </h1>
          <p className="text-xs text-muted-foreground font-semibold">{t("admin_sub")}</p>
        </div>
      </header>

      <div className="px-5 flex gap-2 overflow-x-auto pb-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`press shrink-0 rounded-full px-4 py-2 text-xs font-black ${
              filter === tab.id ? "bg-primary text-primary-foreground" : "bg-surface text-foreground/70 shadow-card"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-5 space-y-4">
        {ordersQ.isLoading && (
          <div className="py-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-foreground" />
          </div>
        )}
        {ordersQ.data?.length === 0 && (
          <p className="py-10 text-center text-sm font-bold text-muted-foreground">{t("admin_none")}</p>
        )}
        {(ordersQ.data ?? []).map((o: any) => (
          <OrderCard
            key={o.id}
            order={o}
            onReviewed={() => {
              qc.invalidateQueries({ queryKey: ["admin-orders"] });
            }}
          />
        ))}
      </div>
    </div>
  );
}

function OrderCard({ order, onReviewed }: { order: any; onReviewed: () => void }) {
  const { t } = useT();
  const review = useServerFn(adminReviewPayment);
  const signUrl = useServerFn(getReceiptUrl);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const receiptQ = useQuery({
    queryKey: ["receipt", order.receipt_url],
    queryFn: () => signUrl({ data: { path: order.receipt_url } }),
    enabled: !!order.receipt_url,
  });

  const act = async (action: "approve" | "reject") => {
    setBusy(action);
    setError(null);
    try {
      await review({ data: { orderId: order.id, action, reason: reason.trim() || null } });
      onReviewed();
    } catch (e: any) {
      setError(e?.message ?? t("err_generic"));
    } finally {
      setBusy(null);
    }
  };

  const pending = order.payment_status === "pending_verification";
  const mismatch =
    order.paid_amount != null && Number(order.paid_amount) !== Number(order.total);

  return (
    <div className="rounded-3xl bg-surface shadow-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black text-foreground">#{String(order.id).slice(0, 8).toUpperCase()}</p>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-black ${
            order.payment_status === "approved"
              ? "bg-track/15 text-track"
              : order.payment_status === "rejected"
                ? "bg-tomato/15 text-tomato"
                : "bg-amber/30 text-foreground"
          }`}
        >
          {t(`pay_status_${order.payment_status}`)}
        </span>
      </div>

      {receiptQ.data?.url ? (
        <a href={receiptQ.data.url} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={receiptQ.data.url}
            alt={t("admin_view_receipt")}
            className="w-full max-h-72 rounded-2xl object-contain bg-muted"
          />
        </a>
      ) : (
        <div className="rounded-2xl bg-muted p-6 flex items-center justify-center gap-2 text-foreground/50">
          <Receipt className="h-5 w-5" strokeWidth={2.5} />
          <span className="text-xs font-bold">{t("admin_no_receipt")}</span>
        </div>
      )}

      <Row label={t("admin_reference")} value={order.payment_reference ?? "—"} />
      <Row
        label={t("admin_declared")}
        value={order.paid_amount != null ? formatUZS(Number(order.paid_amount)) : "—"}
        alert={mismatch}
      />
      <Row label={t("admin_order_total")} value={formatUZS(Number(order.total))} />
      <Row label={t("delivery_address")} value={order.address ?? "—"} />

      {pending && (
        <>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            placeholder={t("admin_reject_reason")}
            className="w-full rounded-2xl bg-muted px-4 py-3 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-amber"
          />
          <div className="flex gap-2">
            <button
              onClick={() => act("approve")}
              disabled={busy !== null}
              className="press flex-1 rounded-full bg-track text-track-foreground py-3 font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={3} />}
              {t("admin_approve")}
            </button>
            <button
              onClick={() => act("reject")}
              disabled={busy !== null}
              className="press flex-1 rounded-full bg-tomato text-white py-3 font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" strokeWidth={3} />}
              {t("admin_reject")}
            </button>
          </div>
        </>
      )}

      {order.rejection_reason && (
        <p className="text-xs font-bold text-tomato">{order.rejection_reason}</p>
      )}
      {error && <p className="text-xs font-bold text-tomato">{error}</p>}
    </div>
  );
}

function Row({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs font-semibold text-foreground/60 shrink-0">{label}</span>
      <span className={`text-xs font-black text-right ${alert ? "text-tomato" : "text-foreground"}`}>{value}</span>
    </div>
  );
}
