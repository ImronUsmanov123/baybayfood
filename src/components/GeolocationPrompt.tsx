import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin, X, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { saveMyLocation, updateMyProfile } from "@/lib/profile.functions";

const ASKED_KEY = "osh.geo.asked";
const COORDS_KEY = "osh.geo.coords";

/** Best-effort reverse geocoding so the captured point shows as a real address. */
async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${latitude}&lon=${longitude}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { display_name?: string; address?: Record<string, string> };
    const a = json.address ?? {};
    const parts = [
      [a.road, a.house_number].filter(Boolean).join(" "),
      a.neighbourhood || a.suburb,
      a.city || a.town || a.village || a.county,
    ].filter(Boolean);
    return (parts.length ? parts.join(", ") : json.display_name) ?? null;
  } catch {
    return null;
  }
}

/**
 * Asks for the device location right after the user signs in or registers and
 * stores the coordinates on the profile so delivery can be pinned precisely.
 * If permission is already granted, the position is captured automatically —
 * no prompt, no manual search.
 */
export function GeolocationPrompt() {
  const { t } = useT();
  const { user } = useAuth();
  const qc = useQueryClient();
  const save = useServerFn(saveMyLocation);
  const saveProfile = useServerFn(updateMyProfile);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const capturing = useRef(false);

  // Key is per-user so a fresh registration always gets the prompt.
  const askedKey = user ? `${ASKED_KEY}.${user.id}` : ASKED_KEY;

  const persist = useCallback(
    async (latitude: number, longitude: number) => {
      try {
        window.localStorage.setItem(COORDS_KEY, JSON.stringify({ latitude, longitude }));
      } catch {
        /* private mode */
      }
      if (!user) return;
      try {
        await save({ data: { latitude, longitude } });
      } catch {
        /* coordinates still cached locally */
      }
      // Fill the delivery address automatically when we can name the point.
      const label = await reverseGeocode(latitude, longitude);
      if (label) {
        try {
          await saveProfile({ data: { address: label } });
          toast.success(t("address_saved"), { description: label });
        } catch {
          /* keep the coordinates even if the label can't be stored */
        }
      }
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    [qc, save, saveProfile, t, user],
  );

  /** Reads the device position and stores it. */
  const capture = useCallback(
    (opts: { silent: boolean }) => {
      if (capturing.current) return;
      capturing.current = true;
      if (!opts.silent) {
        setBusy(true);
        setError(null);
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const latitude = Number(pos.coords.latitude.toFixed(6));
          const longitude = Number(pos.coords.longitude.toFixed(6));
          await persist(latitude, longitude);
          try {
            window.localStorage.setItem(askedKey, "1");
          } catch {
            /* private mode */
          }
          capturing.current = false;
          setBusy(false);
          setOpen(false);
        },
        () => {
          capturing.current = false;
          setBusy(false);
          if (!opts.silent) {
            setError(t("geo_denied"));
            try {
              window.localStorage.setItem(askedKey, "1");
            } catch {
              /* private mode */
            }
          }
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
      );
    },
    [askedKey, persist, t],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;
    // Only act once the user is authenticated (right after login/registration).
    if (!user) return;

    let cancelled = false;
    let status: PermissionStatus | null = null;

    const onGranted = () => {
      if (cancelled) return;
      setOpen(false);
      capture({ silent: true });
    };

    const run = async () => {
      // Permission already granted → capture straight away, skip the sheet.
      try {
        if (navigator.permissions?.query) {
          status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
          if (cancelled) return;
          if (status.state === "granted") {
            onGranted();
            return;
          }
          // The browser prompt may be answered later — react the moment it is.
          status.onchange = () => {
            if (status?.state === "granted") onGranted();
          };
          if (status.state === "denied") return;
        }
      } catch {
        /* Permissions API unavailable — fall back to the sheet */
      }

      let asked = false;
      try {
        asked = window.localStorage.getItem(askedKey) === "1";
      } catch {
        /* private mode */
      }
      if (asked || cancelled) return;
      setOpen(true);
    };

    const timer = setTimeout(run, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (status) status.onchange = null;
      clearTimeout(timer);
    };
  }, [user, askedKey, capture]);

  const dismiss = () => {
    try {
      window.localStorage.setItem(askedKey, "1");
    } catch {
      /* private mode */
    }
    setOpen(false);
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-navy/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[2rem] bg-surface p-6 shadow-chunky">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 shrink-0 rounded-2xl bg-brand flex items-center justify-center">
            <MapPin className="h-6 w-6 text-brand-foreground" strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-black text-foreground">{t("geo_title")}</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">{t("geo_body")}</p>
          </div>
          <button
            onClick={dismiss}
            aria-label={t("cancel")}
            className="press h-9 w-9 rounded-full bg-muted flex items-center justify-center"
          >
            <X className="h-4 w-4 text-foreground" strokeWidth={3} />
          </button>
        </div>

        {error && <p className="mt-3 text-xs font-bold text-tomato">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button
            onClick={dismiss}
            className="press flex-1 rounded-full bg-muted py-3 text-sm font-black text-foreground"
          >
            {t("geo_later")}
          </button>
          <button
            onClick={() => capture({ silent: false })}
            disabled={busy}
            className="press flex-[1.4] rounded-full bg-primary py-3 text-sm font-black text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("geo_allow")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
