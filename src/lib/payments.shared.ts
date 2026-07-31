import { z } from "zod";

export type PaymentStatus =
  | "unpaid"
  | "awaiting_payment"
  | "pending_verification"
  | "approved"
  | "rejected";

export const submitProofSchema = z.object({
  orderId: z.string().uuid(),
  receiptPath: z.string().trim().min(3).max(400),
  reference: z.string().trim().min(2).max(120),
  amount: z.number().nonnegative(),
});

export const reviewSchema = z.object({
  orderId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(300).optional().nullable(),
});

export const adminListSchema = z.object({
  status: z.enum(["pending_verification", "approved", "rejected", "all"]).default("pending_verification"),
});

export const receiptPathSchema = z.object({ path: z.string().trim().min(3).max(400) });
