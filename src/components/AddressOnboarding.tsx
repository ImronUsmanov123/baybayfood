import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { updateMyProfile } from "@/lib/profile.functions";
import { useT } from "@/lib/i18n";

const skipKey = (userId: string) => `osh:addr-onboarding-skipped:${userId}`;

export function hasSkippedAddressOnboarding(userId: string) {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(skipKey(userId)) === "1";
}

/**
 * First-run prompt: asks a freshly signed-in user for a delivery address when
 * their profile has none yet. Skipping is remembered per user so the popup
 * doesn't nag on every visit — checkout still reminds them before ordering.
 */
export function AddressOnboarding({
  userId,
  hasAddress,
  ready,
}: {
  userId: string | undefined;
  hasAddress: boolean;
  ready: boolean;
}) {
  const { t } = useT();
  const qc = useQueryClient();
  const saveProfile = useServerFn(updateMyProfile);

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !userId || hasAddress) return;
    if (hasSkippedAddressOnboarding(userId)) return;
    setOpen(true);
  }, [ready, userId, hasAddress]);

  const skip = () => {
    if (userId) window.localStorage.setItem(skipKey(userId), "1");
    setOpen(false);
  };

  const save = async () => {
    const next = value.trim();
    if (!next) {
      setError(t("address_required"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveProfile({ data: { address: next } });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      if (userId) window.localStorage.removeItem(skipKey(userId));
      setOpen(false);
    } catch (e: any) {
      setError(e?.message ?? t("err_generic"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-primary-foreground/70 flex items-end sm:items-center justify-center"
        >
          <motion.div
            initial={{ y: 60 }}
            animate={{ y: 0 }}
            exit={{ y: 60 }}
            className="w-full max-w-md bg-background rounded-t-[2rem] sm:rounded-3xl shadow-chunky p-5"
          >
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-amber flex items-center justify-center">
                <MapPin className="h-5 w-5 text-foreground" strokeWidth={2.5} />
              </div>
              <h2 className="text-xl font-black text-foreground leading-tight">{t("onb_addr_title")}</h2>
            </div>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">{t("onb_addr_sub")}</p>

            <textarea
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={3}
              maxLength={280}
              placeholder={t("address_placeholder")}
              className="mt-4 w-full rounded-2xl bg-muted px-4 py-3 text-sm font-semibold text-foreground placeholder:text-foreground/40 outline-none resize-none"
            />
            {error && <p className="mt-2 text-xs font-semibold text-tomato">{error}</p>}

            <div className="mt-4 flex gap-3">
              <button onClick={skip} className="press flex-1 rounded-full bg-muted text-foreground py-3.5 font-black">
                {t("onb_addr_skip")}
              </button>
              <button
                disabled={saving}
                onClick={save}
                className="press flex-1 rounded-full bg-primary text-primary-foreground py-3.5 font-black disabled:opacity-60"
              >
                {t("onb_addr_save")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
