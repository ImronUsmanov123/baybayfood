import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Pencil, Banknote, Check, Loader2, CreditCard, Copy, Tag, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useStore, cartTotal } from "@/lib/store";
import { formatUZS } from "@/lib/format";
import { tgHaptic } from "@/lib/telegram";
import { useT } from "@/lib/i18n";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { getPaymentDetails } from "@/lib/payments.functions";
import { createOrder, advanceOrder, validatePromo } from "@/lib/orders.functions";


export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({
    meta: [
      { title: "Rasmiylashtirish / Оформление — Bay Bay Food" },
      { name: "description", content: "Yetkazib berishni tasdiqlang va to'lang. Подтвердите доставку и оплату." },
      { property: "og:title", content: "Rasmiylashtirish / Оформление — Bay Bay Food" },
      { property: "og:description", content: "Yetkazib berishni tasdiqlang va to'lang. Подтвердите доставку и оплату." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkout,
});

type Method = "cash" | "card";
type AppliedPromo = { code: string; discount: number; freeDelivery: boolean };

function Checkout() {
  const { t } = useT();
  const cart = useStore((s) => s.cart);
  const clearCart = useStore((s) => s.clearCart);
  const navigate = useNavigate();
  const [method, setMethod] = useState<Method>("cash");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [editingAddress, setEditingAddress] = useState(false);
  const [comment, setComment] = useState("");
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<AppliedPromo | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [qrAlert, setQrAlert] = useState(false);

  const fetchProfile = useServerFn(getMyProfile);
  const saveProfile = useServerFn(updateMyProfile);
  const create = useServerFn(createOrder);
  const advance = useServerFn(advanceOrder);
  const checkPromo = useServerFn(validatePromo);
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const fetchPayDetails = useServerFn(getPaymentDetails);
  const payDetailsQ = useQuery({
    queryKey: ["payment-details"],
    queryFn: () => fetchPayDetails(),
    enabled: method === "card",
  });

  useEffect(() => {
    if (profileQ.data?.address && !address) setAddress(profileQ.data.address);
  }, [profileQ.data, address]);

  const subtotal = cartTotal(cart);

  const [copiedCard, setCopiedCard] = useState(false);
  const cardNumber = payDetailsQ.data?.number ?? "";
  // Falls back to a QR generated from the card details when the admin has not
  // uploaded an explicit QR image yet.
  const qrSrc =
    payDetailsQ.data?.qrUrl ||
    (cardNumber
      ? `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=8&data=${encodeURIComponent(
          cardNumber.replace(/\s/g, ""),
        )}`
      : "");

  const selectCard = () => {
    setMethod("card");
    tgHaptic("light");
    setQrAlert(true);
  };
  const copyCard = async () => {
    try {
      await navigator.clipboard.writeText((payDetailsQ.data?.number ?? "").replace(/\s/g, ""));
      setCopiedCard(true);
      tgHaptic("light");
      setTimeout(() => setCopiedCard(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };
  const baseDelivery = subtotal >= 150000 || cart.length === 0 ? 0 : 15000;
  const delivery = promo?.freeDelivery ? 0 : baseDelivery;
  const discount = promo?.discount ?? 0;
  const total = Math.max(0, subtotal + delivery - discount);

  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;
    setPromoChecking(true);
    setPromoError(null);
    try {
      const res = await checkPromo({ data: { code, subtotal, delivery: baseDelivery } });
      if (!res.ok) {
        setPromo(null);
        setPromoError(
          res.reason === "expired"
            ? t("promo_expired")
            : res.reason === "min"
              ? t("promo_min", { amount: formatUZS((res as any).minSubtotal ?? 0) })
              : t("promo_invalid"),
        );
        return;
      }
      tgHaptic("success");
      setPromo({ code: res.code, discount: res.discount, freeDelivery: res.freeDelivery });
    } catch {
      setPromoError(t("err_generic"));
    } finally {
      setPromoChecking(false);
    }
  };

  const simulateProgress = (id: string) => {
    setTimeout(() => advance({ data: { id, status: "cooking" } }).catch(() => {}), 4000);
    setTimeout(() => advance({ data: { id, status: "on_the_way" } }).catch(() => {}), 12000);
    setTimeout(() => advance({ data: { id, status: "arriving_soon" } }).catch(() => {}), 20000);
    setTimeout(() => advance({ data: { id, status: "delivered" } }).catch(() => {}), 28000);
  };

  const handlePlace = async () => {
    if (cart.length === 0) return;
    if (!address.trim()) {
      setError(t("need_address"));
      setEditingAddress(true);
      return;
    }
    setPlacing(true);
    setError(null);
    tgHaptic("medium");
    try {
      if (address.trim() && address.trim() !== (profileQ.data?.address ?? "")) {
        await saveProfile({ data: { address: address.trim() } }).catch(() => {});
      }

      const order = await create({
        data: {
          items: cart,
          subtotal,
          delivery,
          discount,
          total,
          paymentMethod: method,
          address,
          phone: profileQ.data?.phone ?? null,
          comment: comment.trim() || null,
          promoCode: promo?.code ?? null,
        },
      });
      clearCart();
      simulateProgress(order.id);
      navigate({ to: "/order/$id", params: { id: order.id } });
    } catch (e: any) {
      setError(e?.message ?? t("order_failed"));
      setPlacing(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-foreground font-bold">{t("cart_empty")}</p>
        <Link
          to="/"
          className="mt-4 inline-block rounded-full bg-primary text-primary-foreground px-6 py-3 font-bold text-sm"
        >
          {t("browse_menu")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md pb-40">
      <header className="px-5 pt-6 pb-4 flex items-center gap-3">
        <Link
          to="/cart"
          className="h-11 w-11 rounded-full bg-surface shadow-card flex items-center justify-center press"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" strokeWidth={2.5} />
        </Link>
        <h1 className="text-2xl font-black text-foreground">{t("checkout")}</h1>
      </header>

      <div className="px-5 space-y-5">
        {/* Address */}
        <section>
          <h3 className="text-xs font-extrabold text-foreground/60 uppercase tracking-wide mb-2">
            {t("delivery_address")}
          </h3>
          <div className="rounded-3xl bg-surface shadow-card p-4">
            {editingAddress ? (
              <textarea
                autoFocus
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onBlur={() => setEditingAddress(false)}
                rows={3}
                maxLength={280}
                placeholder={t("address_placeholder")}
                className="w-full rounded-2xl bg-muted p-3 text-foreground font-semibold outline-none focus:ring-2 focus:ring-amber resize-none"
              />
            ) : (
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-amber flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-foreground" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-extrabold text-foreground">{t("deliver_to")}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {address || t("tap_edit_address")}
                  </p>
                </div>
                <button
                  onClick={() => setEditingAddress(true)}
                  className="h-9 w-9 rounded-full bg-muted flex items-center justify-center press"
                  aria-label={t("edit_address")}
                >
                  <Pencil className="h-4 w-4 text-foreground" strokeWidth={2.5} />
                </button>
              </div>
            )}
          </div>
          {!address.trim() && (
            <p className="mt-2 px-1 text-xs font-semibold text-tomato">{t("addr_reminder")}</p>
          )}
        </section>

        {/* Summary */}
        <section>
          <h3 className="text-xs font-extrabold text-foreground/60 uppercase tracking-wide mb-2">
            {t("order_summary", { n: cart.length })}
          </h3>
          <div className="rounded-3xl bg-surface shadow-card p-4 space-y-3">
            {cart.map((i) => (
              <div key={i.key} className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-muted overflow-hidden shrink-0">
                  <img src={i.image} alt="" width={128} height={128} className="h-full w-full object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-extrabold text-foreground line-clamp-1">{i.name}</p>
                  <p className="text-[11px] text-muted-foreground font-semibold">
                    {t(`size_${i.size}`)} · x{i.qty}
                  </p>
                </div>
                <span className="text-sm font-black text-foreground">{formatUZS(i.unitPrice * i.qty)}</span>
              </div>
            ))}
            <div className="h-px bg-foreground/10" />
            <Row label={t("subtotal")} value={formatUZS(subtotal)} />
            <Row label={t("delivery")} value={delivery === 0 ? t("free") : formatUZS(delivery)} />
            {discount > 0 && <Row label={t("discount")} value={`− ${formatUZS(discount)}`} />}
            <Row label={t("total")} value={formatUZS(total)} bold />
          </div>
        </section>

        {/* Promo code */}
        <section>
          <h3 className="text-xs font-extrabold text-foreground/60 uppercase tracking-wide mb-2">
            {t("promo_title")}
          </h3>
          <div className="rounded-3xl bg-surface shadow-card p-4">
            {promo ? (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-track/15 flex items-center justify-center">
                  <Tag className="h-5 w-5 text-track" strokeWidth={2.5} />
                </div>
                <p className="flex-1 text-sm font-extrabold text-foreground">
                  {t("promo_applied", { code: promo.code })}
                </p>
                <button
                  onClick={() => {
                    setPromo(null);
                    setPromoInput("");
                  }}
                  className="text-xs font-bold text-tomato press"
                >
                  {t("promo_remove")}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  maxLength={40}
                  placeholder={t("promo_placeholder")}
                  className="flex-1 min-w-0 rounded-2xl bg-muted px-4 py-3 text-sm font-bold text-foreground uppercase outline-none focus:ring-2 focus:ring-amber"
                />
                <button
                  onClick={applyPromo}
                  disabled={promoChecking || !promoInput.trim()}
                  className="press rounded-2xl bg-primary text-primary-foreground px-4 py-3 text-sm font-black disabled:opacity-50"
                >
                  {promoChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : t("promo_apply")}
                </button>
              </div>
            )}
            {promoError && <p className="mt-2 text-xs font-bold text-tomato">{promoError}</p>}
          </div>
        </section>

        {/* Comment */}
        <section>
          <h3 className="text-xs font-extrabold text-foreground/60 uppercase tracking-wide mb-2">
            {t("comment_title")}
          </h3>
          <div className="rounded-3xl bg-surface shadow-card p-4">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={t("comment_placeholder")}
              className="w-full rounded-2xl bg-muted p-3 text-sm font-semibold text-foreground placeholder:text-foreground/40 outline-none focus:ring-2 focus:ring-amber resize-none"
            />
          </div>
        </section>

        {/* Payment */}
        <section>
          <h3 className="text-xs font-extrabold text-foreground/60 uppercase tracking-wide mb-2">
            {t("payment_method")}
          </h3>
          <div className="space-y-2">
            <PayOption
              active={method === "cash"}
              onClick={() => setMethod("cash")}
              title={t("pay_cash")}
              subtitle={t("pay_cash_sub")}
              logo={
                <div className="h-11 w-11 rounded-2xl bg-muted text-foreground flex items-center justify-center">
                  <Banknote className="h-5 w-5" strokeWidth={2.5} />
                </div>
              }
            />
            <PayOption
              active={method === "card"}
              onClick={selectCard}
              title={t("pay_card")}
              subtitle={t("pay_card_sub")}
              logo={
                <div className="h-11 w-11 rounded-2xl bg-track text-track-foreground flex items-center justify-center">
                  <CreditCard className="h-5 w-5" strokeWidth={2.5} />
                </div>
              }
            />
          </div>

          {method === "card" && (
            <div className="mt-3 space-y-3">
              <div className="rounded-3xl bg-track text-track-foreground p-5">
                <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                  {t("transfer_details_title")}
                </p>
                {payDetailsQ.data?.bank && (
                  <>
                    <p className="mt-3 text-[11px] font-bold uppercase tracking-wider opacity-80">
                      {t("bank_name")}
                    </p>
                    <p className="text-sm font-extrabold">{payDetailsQ.data.bank}</p>
                  </>
                )}
                <p className="mt-3 text-[11px] font-bold uppercase tracking-wider opacity-80">
                  {t("card_number")}
                </p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className="text-xl font-black tracking-wide">
                    {payDetailsQ.isLoading ? "…" : payDetailsQ.data?.number || "—"}
                  </p>
                  <button
                    onClick={copyCard}
                    className="press rounded-full bg-track-foreground/20 px-3 py-2 text-xs font-black flex items-center gap-1.5"
                  >
                    <Copy className="h-3.5 w-3.5" strokeWidth={3} />
                    {copiedCard ? t("copied") : t("copy")}
                  </button>
                </div>
                <p className="mt-3 text-[11px] font-bold uppercase tracking-wider opacity-80">
                  {t("card_holder")}
                </p>
                <p className="text-sm font-extrabold">
                  {payDetailsQ.isLoading ? "…" : payDetailsQ.data?.holder || "—"}
                </p>
              </div>

              {qrSrc ? (
                <div className="rounded-3xl bg-surface shadow-card p-4 text-center">
                  <p className="text-xs font-extrabold text-foreground/60 uppercase tracking-wide">{t("scan_qr")}</p>
                  <img
                    src={qrSrc}
                    alt={t("scan_qr")}
                    className="mx-auto mt-3 h-48 w-48 rounded-2xl object-contain bg-muted p-2"
                  />
                </div>
              ) : null}

              <div className="rounded-3xl bg-muted p-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground/70">{t("amount_to_pay")}</span>
                <span className="text-lg font-black text-foreground">{formatUZS(total)}</span>
              </div>

              <div className="rounded-3xl bg-amber/20 border-2 border-amber p-4 flex gap-3">
                <Info className="h-5 w-5 shrink-0 text-foreground" strokeWidth={2.5} />
                <p className="text-xs font-bold leading-relaxed text-foreground">{t("transfer_warning")}</p>
              </div>
            </div>
          )}
        </section>

        {error && <p className="text-sm font-bold text-tomato text-center">{error}</p>}
      </div>

      {qrAlert && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-primary-foreground/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[2rem] bg-surface p-6 shadow-chunky text-center">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-amber flex items-center justify-center">
              <Info className="h-6 w-6 text-foreground" strokeWidth={2.5} />
            </div>
            <h2 className="mt-3 text-lg font-black text-foreground">{t("qr_alert_title")}</h2>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-muted-foreground">
              {t("transfer_warning")}
            </p>
            <button
              onClick={() => setQrAlert(false)}
              className="press mt-5 w-full rounded-full bg-primary py-3 text-sm font-black text-primary-foreground"
            >
              {t("close")}
            </button>
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-50 safe-b px-5 pt-3 bg-gradient-to-t from-background via-background to-transparent">
        <div className="mx-auto max-w-md">
          <button
            disabled={placing}
            onClick={handlePlace}
            className="press w-full rounded-full bg-primary text-primary-foreground py-4 font-black shadow-chunky flex items-center justify-between px-6 disabled:opacity-70"
          >
            <span className="flex items-center gap-2">
              {placing && <Loader2 className="h-5 w-5 animate-spin" />}
              {placing ? t("placing") : t("place_order")}
            </span>
            <span className="text-primary-foreground">{formatUZS(total)}</span>
          </button>
        </div>
      </div>

    </div>
  );
}

function PayOption({
  active,
  onClick,
  title,
  subtitle,
  logo,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  logo: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`press w-full rounded-3xl p-4 flex items-center gap-3 border-2 transition-all text-left ${
        active ? "border-foreground bg-muted" : "border-transparent bg-surface shadow-card"
      }`}
    >
      {logo}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-extrabold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground font-semibold">{subtitle}</p>
      </div>
      <div
        className={`h-6 w-6 rounded-full flex items-center justify-center ${
          active ? "bg-primary" : "border-2 border-foreground/20"
        }`}
      >
        {active && <Check className="h-4 w-4 text-primary-foreground" strokeWidth={3} />}
      </div>
    </button>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "text-base font-black text-foreground" : "text-sm font-semibold text-foreground/70"}>{label}</span>
      <span className={bold ? "text-lg font-black text-foreground" : "text-sm font-bold text-foreground"}>{value}</span>
    </div>
  );
}
