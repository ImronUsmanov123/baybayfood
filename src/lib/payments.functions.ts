import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  adminListSchema,
  receiptPathSchema,
  reviewSchema,
  submitProofSchema,
} from "@/lib/payments.shared";

/** Env fallbacks so the checkout card/QR block works before the Admin Panel exists. */
function envValue(name: string): string {
  try {
    return (globalThis.process?.env?.[name] ?? "").trim();
  } catch {
    return "";
  }
}

/** Legacy rows may still carry the pre-rebrand company name. */
const BRAND_NAME = "Bay Bay Food";
function rebrand(value: string): string {
  return value.replace(/osh\s*pizza(\s*llc)?/gi, BRAND_NAME);
}

/** Bank / card details shown to the customer for a manual transfer. */
export const getPaymentDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("app_settings")
      .select("key, value")
      .like("key", "payment_%");
    if (error) throw new Error(error.message);
    const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
    return {
      number: map.payment_card_number || envValue("PAYMENT_CARD_NUMBER"),
      holder: rebrand(map.payment_card_holder || envValue("PAYMENT_CARD_HOLDER") || BRAND_NAME),
      bank: map.payment_bank_name || envValue("PAYMENT_BANK_NAME"),
      instructions: rebrand(map.payment_instructions || envValue("PAYMENT_INSTRUCTIONS")),
      qrUrl: map.payment_qr_url || envValue("PAYMENT_QR_URL"),
    };
  });

/** Customer submits proof of a manual transfer for review. */
export const submitPaymentProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => submitProofSchema.parse(input))
  .handler(async ({ context, data }) => {
    if (!data.receiptPath.startsWith(`${context.userId}/`)) {
      throw new Error("Invalid receipt file.");
    }
    const { data: row, error } = await context.supabase
      .from("orders")
      .update({
        receipt_url: data.receiptPath,
        payment_reference: data.reference,
        paid_amount: data.amount,
        payment_status: "pending_verification",
        submitted_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq("id", data.orderId)
      .eq("user_id", context.userId)
      .select("id, total")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Order not found.");

    const { notifyUser } = await import("@/lib/notify.server");
    await notifyUser({
      userId: context.userId,
      kind: "payment_pending",
      title: "Payment submitted for review",
      body: `We received your receipt for order #${row.id.slice(0, 8).toUpperCase()}. An admin will verify it shortly.`,
      orderId: row.id,
      telegramHtml: `🧾 <b>Payment submitted</b>\n\nOrder <code>#${row.id.slice(0, 8).toUpperCase()}</code>\nReference: <code>${data.reference}</code>\nWe'll confirm as soon as an admin verifies the transfer.`,
    });

    return { ok: true as const };
  });

/** Signed URL for a receipt image — owner or admin only. */
export const getReceiptUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => receiptPathSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin && !data.path.startsWith(`${context.userId}/`)) {
      throw new Error("Forbidden");
    }
    const { data: signed, error } = await context.supabase.storage
      .from("receipts")
      .createSignedUrl(data.path, 60 * 30);
    if (error) throw new Error(error.message);
    return { url: signed?.signedUrl ?? null };
  });

/** Is the current user an admin? */
export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { admin: !!data };
  });

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

/** Admin: orders by payment status. */
export const adminListOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => adminListSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    let q = context.supabase
      .from("orders")
      .select("*")
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .limit(100);
    if (data.status !== "all") q = q.eq("payment_status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Admin: approve or reject a submitted payment. */
export const adminReviewPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => reviewSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const approve = data.action === "approve";

    const { data: row, error } = await context.supabase
      .from("orders")
      .update({
        payment_status: approve ? "approved" : "rejected",
        paid: approve,
        paid_at: approve ? new Date().toISOString() : null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
        rejection_reason: approve ? null : (data.reason?.trim() || "Transfer could not be verified."),
        status: approve ? "cooking" : "cancelled",
      })
      .eq("id", data.orderId)
      .select("id, user_id, total")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Order not found.");

    const { notifyUser } = await import("@/lib/notify.server");
    const short = `#${row.id.slice(0, 8).toUpperCase()}`;
    await notifyUser({
      userId: row.user_id,
      kind: approve ? "payment_approved" : "payment_rejected",
      title: approve ? "Payment confirmed" : "Payment rejected",
      body: approve
        ? `Your transfer for order ${short} was verified. We're preparing your order now.`
        : `We couldn't verify your transfer for order ${short}. ${data.reason?.trim() ?? ""}`.trim(),
      orderId: row.id,
      telegramHtml: approve
        ? `✅ <b>Payment confirmed</b>\n\nOrder <code>${short}</code>\nYour transfer was verified — we're firing up the oven!`
        : `❌ <b>Payment rejected</b>\n\nOrder <code>${short}</code>\n${data.reason?.trim() ?? "Transfer could not be verified."}`,
    });

    return { ok: true as const, approved: approve };
  });
