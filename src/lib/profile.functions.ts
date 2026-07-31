import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeUzPhone } from "@/lib/phone";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data;

    // Self-heal: guarantee every signed-in user has a profile row so address
    // editing, language and notification settings always have something to write to.
    const { data: created, error: createError } = await context.supabase
      .from("profiles")
      .upsert({ id: context.userId }, { onConflict: "id" })
      .select("*")
      .maybeSingle();
    if (createError) throw new Error(createError.message);
    return created;
  });


export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        username: z.string().trim().max(40).optional().nullable(),
        first_name: z.string().trim().max(60).optional().nullable(),
        last_name: z.string().trim().max(60).optional().nullable(),
        phone: z
          .string()
          .trim()
          .max(24)
          .optional()
          .nullable()
          .transform((v, ctx) => {
            if (v === undefined || v === null || v === "") return v ?? null;
            const e164 = normalizeUzPhone(v);
            if (!e164) {
              ctx.addIssue({ code: "custom" as const, message: "Enter a valid number: +998 xx xxx xx xx" });
              return z.NEVER;
            }
            return e164;
          }),
        address: z.string().trim().max(280).optional().nullable(),
        language: z.enum(["uz", "ru"]).optional(),
        avatar_url: z.string().trim().max(500).optional().nullable(),
        notifications_enabled: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const patch = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined),
    ) as typeof data;

    // Upsert, not update: a profile row can be missing (e.g. the account was
    // created before the trigger existed), and a plain UPDATE would silently
    // affect zero rows and look like "saving does nothing".
    const { error, data: row } = await context.supabase
      .from("profiles")
      .upsert({ ...patch, id: context.userId }, { onConflict: "id" })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });


/** Saves the device coordinates captured by the startup location prompt. */
export const saveMyLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error, data: row } = await context.supabase
      .from("profiles")
      .upsert(
        {
          id: context.userId,
          latitude: data.latitude,
          longitude: data.longitude,
          location_updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )
      .select("id, latitude, longitude")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });
