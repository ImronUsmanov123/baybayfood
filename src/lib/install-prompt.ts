/**
 * Captures `beforeinstallprompt` as early as the bundle loads, so the event is
 * never lost when it fires before <InstallBanner /> mounts.
 */
export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredEvent: InstallPromptEvent | null = null;
const listeners = new Set<(e: InstallPromptEvent | null) => void>();

function emit() {
  listeners.forEach((fn) => fn(deferredEvent));
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    deferredEvent = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredEvent = null;
    emit();
  });
}

export function getInstallPrompt(): InstallPromptEvent | null {
  return deferredEvent;
}

export function clearInstallPrompt() {
  deferredEvent = null;
  emit();
}

export function onInstallPrompt(fn: (e: InstallPromptEvent | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** True for iOS Safari, which never fires `beforeinstallprompt`. */
export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
  return iOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
