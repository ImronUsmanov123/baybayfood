export type MoneyLang = "ru" | "uz" | "en";

const SUFFIX: Record<MoneyLang, string> = {
  ru: "сум",
  uz: "so'm",
  en: "so'm",
};

// Must match the I18nProvider's initial (SSR) language so hydration matches.
let currentLang: MoneyLang = "uz";

/** Called by the i18n provider so money formatting follows the active language. */
export function setMoneyLang(lang: MoneyLang) {
  currentLang = lang;
}

export function moneySuffix(lang: MoneyLang = currentLang): string {
  return SUFFIX[lang] ?? SUFFIX.ru;
}

export function formatUZS(amount: number, lang: MoneyLang = currentLang): string {
  const n = new Intl.NumberFormat("ru-RU").format(Math.round(amount || 0));
  return `${n} ${moneySuffix(lang)}`;
}

export function shortId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Human order reference derived from the row id, e.g. "#3F9A2C1B". */
export function orderRef(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

export function formatDateTime(iso: string, lang: MoneyLang = currentLang): string {
  const locale = lang === "ru" ? "ru-RU" : lang === "uz" ? "uz-UZ" : "en-GB";
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}
