import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { advanceOrderSchema, createOrderSchema, orderIdSchema, promoSchema, STATUS_RANK } from "@/lib/orders.shared";

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createOrderSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { error, data: row } = await context.supabase
      .from("orders")
      .insert({
        user_id: context.userId,
        items: data.items as any,
        subtotal: data.subtotal,
        delivery: data.delivery,
        discount: data.discount ?? 0,
        total: data.total,
        payment_method: data.paymentMethod,
        address: data.address,
        phone: data.phone ?? null,
        comment: data.comment?.trim() ? data.comment.trim() : null,
        promo_code: data.promoCode?.trim() ? data.promoCode.trim().toUpperCase() : null,
        paid: false,
        // Payment happens on delivery (cash or transfer shown to the courier),
        // so no online verification step gates the order.
        payment_status: "unpaid",
        status: "placed",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    // The database trigger creates the localized notification and delivers it
    // to Telegram, so no manual fan-out is needed here.
    return row;
  });

export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("orders")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => orderIdSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("orders")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const advanceOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => advanceOrderSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: current, error: readError } = await context.supabase
      .from("orders")
      .select("id, status")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!current) throw new Error("Order not found.");

    const currentStatus = String(current.status);
    // Cancelled and delivered are terminal; never regress to an earlier step.
    if (currentStatus === "cancelled" || currentStatus === "delivered") {
      return { ok: true, status: currentStatus };
    }
    if ((STATUS_RANK[data.status] ?? 0) <= (STATUS_RANK[currentStatus] ?? 0)) {
      return { ok: true, status: currentStatus };
    }

    const { data: row, error } = await context.supabase
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id, total")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Order not found.");

    // Notification + Telegram delivery is handled by the order status trigger.
    return { ok: true, status: data.status };
  });

/** Validates a promo code against the current basket and returns the discount. */
export const validatePromo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => promoSchema.parse(input))
  .handler(async ({ context, data }) => {
    const code = data.code.trim().toUpperCase();
    const { data: row, error } = await context.supabase
      .from("promo_codes")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { ok: false as const, reason: "invalid" as const };
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      return { ok: false as const, reason: "expired" as const };
    }
    if (data.subtotal < Number(row.min_subtotal)) {
      return { ok: false as const, reason: "min" as const, minSubtotal: Number(row.min_subtotal) };
    }
    const percentOff = Math.round((data.subtotal * (row.discount_percent ?? 0)) / 100);
    const amountOff = Number(row.discount_amount ?? 0);
    const discount = Math.min(data.subtotal, percentOff + amountOff);
    return {
      ok: true as const,
      code,
      discount,
      freeDelivery: !!row.free_delivery,
    };
  });

/** Card details the customer transfers to for online card payments. */
export const getPaymentCard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["payment_card_number", "payment_card_holder"]);
    if (error) throw new Error(error.message);
    const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
    return {
      number: map.payment_card_number ?? "",
      holder: map.payment_card_holder ?? "",
    };
  });

/** Customer confirms they transferred the amount for a card order. */
export const markOrderPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => orderIdSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("orders")
      .update({ paid: true, paid_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Order not found.");
    return row;
  });
