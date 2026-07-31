import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import {
  clearInstallPrompt,
  getInstallPrompt,
  isIosSafari,
  isStandalone,
  onInstallPrompt,
  type InstallPromptEvent,
} from "@/lib/install-prompt";

const DISMISSED_KEY = "osh.pwa.dismissed";

/** Smooth "add to home screen" banner driven by `beforeinstallprompt`. */
export function InstallBanner() {
  const { t } = useT();
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      /* private mode */
    }
    if (dismissed) return;

    // The event may already have fired before this component mounted.
    const existing = getInstallPrompt();
    if (existing) {
      setDeferred(existing);
      setTimeout(() => setVisible(true), 1200);
    } else if (isIosSafari()) {
      setIos(true);
      setTimeout(() => setVisible(true), 2000);
    }

    const off = onInstallPrompt((e) => {
      setDeferred(e);
      if (e) setTimeout(() => setVisible(true), 1200);
      else setVisible(false);
    });
    return off;
  }, []);

  const close = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* private mode */
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => null);
    clearInstallPrompt();
    setDeferred(null);
    close();
  };

  if (!visible || (!deferred && !ios)) return null;

  return (
    <div
      className={`fixed inset-x-0 bottom-24 z-[65] px-4 transition-all duration-500 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      }`}
    >
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-[1.75rem] bg-primary p-3 pl-4 shadow-chunky">
        <div className="h-11 w-11 shrink-0 rounded-2xl bg-amber flex items-center justify-center">
          <Download className="h-5 w-5 text-foreground" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-primary-foreground">{t("pwa_title")}</p>
          <p className="truncate text-[11px] font-semibold text-primary-foreground/70">
            {ios ? t("pwa_ios_hint") : t("pwa_body")}
          </p>
        </div>
        {!ios && (
          <button onClick={install} className="press rounded-full bg-amber px-4 py-2.5 text-xs font-black text-amber-foreground">
            {t("pwa_install")}
          </button>
        )}
        <button
          onClick={close}
          aria-label={t("cancel")}
          className="press h-9 w-9 rounded-full bg-primary-foreground/10 flex items-center justify-center"
        >
          <X className="h-4 w-4 text-primary-foreground" strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}
