import { useEffect, useRef, useState } from "react";
import { Globe, Check } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { LANGS, useT, type Lang } from "@/lib/i18n";
import { updateMyProfile } from "@/lib/profile.functions";
import { useAuth } from "@/hooks/use-auth";
import { tgHaptic } from "@/lib/telegram";

/** Compact RU / UZ switcher. Persists to the profile when signed in. */
export function LanguageToggle({ variant = "icon" }: { variant?: "icon" | "segmented" }) {
  const { lang, setLang, t } = useT();
  const { user } = useAuth();
  const qc = useQueryClient();
  const saveProfile = useServerFn(updateMyProfile);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = async (code: Lang) => {
    tgHaptic("light");
    setLang(code);
    setOpen(false);
    if (user) {
      try {
        await saveProfile({ data: { language: code } });
        qc.invalidateQueries({ queryKey: ["profile"] });
      } catch {
        /* language still applies locally */
      }
    }
  };

  if (variant === "segmented") {
    return (
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("language")}>
        {LANGS.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => pick(l.code)}
            className={`press rounded-2xl py-3 text-sm font-black ${
              lang === l.code ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
            }`}
          >
            {l.short}
          </button>
        ))}
      </div>
    );
  }

  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t("language")}
        aria-expanded={open}
        className="h-11 px-3 rounded-full bg-surface shadow-card flex items-center gap-1.5 press"
      >
        <Globe className="h-4.5 w-4.5 text-foreground" strokeWidth={2.5} />
        <span className="text-xs font-black text-foreground">{current.short}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-13 z-50 w-40 rounded-2xl bg-surface shadow-chunky p-1.5">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => pick(l.code)}
              className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold text-foreground hover:bg-muted press"
            >
              {l.label}
              {lang === l.code && <Check className="h-4 w-4 text-foreground" strokeWidth={3} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
