// Uzbekistan phone helpers — shared by client and server.
// Canonical display format: "+998 xx xxx xx xx"

export const UZ_DIAL_CODE = "998";
export const UZ_NATIONAL_LENGTH = 9; // xx xxx xx xx

/** Digits typed by the user, without the +998 country code. */
export function nationalDigits(raw: string): string {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.startsWith(UZ_DIAL_CODE)) d = d.slice(UZ_DIAL_CODE.length);
  // A user pasting "8 90 ..." or a leading zero — drop the trunk prefix.
  if (d.length > UZ_NATIONAL_LENGTH && d.startsWith("8")) d = d.slice(1);
  return d.slice(0, UZ_NATIONAL_LENGTH);
}

/** Progressive input mask: "+998 90 123 45 67" */
export function formatUzPhone(raw: string): string {
  const d = nationalDigits(raw);
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return `+${UZ_DIAL_CODE}${parts.length ? " " + parts.join(" ") : " "}`;
}

/** E.164 form ("+998901234567") or null when incomplete/invalid. */
export function normalizeUzPhone(raw: string): string | null {
  const d = nationalDigits(raw);
  if (d.length !== UZ_NATIONAL_LENGTH) return null;
  // Uzbek mobile operator codes are 2 digits starting at 33 and up.
  if (!/^(2[0-9]|3[0-9]|[5-9][0-9])/.test(d)) return null;
  return `+${UZ_DIAL_CODE}${d}`;
}

export function isValidUzPhone(raw: string): boolean {
  return normalizeUzPhone(raw) !== null;
}

/** "+998 90 *** ** 67" for confirmation copy. */
export function maskUzPhone(e164: string): string {
  const d = nationalDigits(e164);
  if (d.length !== UZ_NATIONAL_LENGTH) return e164;
  return `+${UZ_DIAL_CODE} ${d.slice(0, 2)} *** ** ${d.slice(7)}`;
}
