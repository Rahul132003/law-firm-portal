/**
 * Firm branding. Safe to import from client components — the underlying env
 * var is NEXT_PUBLIC_ prefixed and contains no secrets.
 *
 * Change NEXT_PUBLIC_FIRM_NAME in .env rather than editing this file.
 */
export const FIRM_NAME =
  process.env.NEXT_PUBLIC_FIRM_NAME?.trim() || "Pawar & Associates";

/**
 * IANA time zone the firm works in. Decides which calendar day recorded time
 * belongs to, so it must not depend on where the server happens to run.
 */
export const FIRM_TIME_ZONE = (() => {
  const configured = process.env.NEXT_PUBLIC_FIRM_TIME_ZONE?.trim() || "Asia/Kolkata";
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: configured });
    return configured;
  } catch {
    return "Asia/Kolkata";
  }
})();

/** Compact form used in the sidebar mark and favicons. */
export const FIRM_INITIALS = FIRM_NAME.split(/\s+/)
  .filter((word) => /^[A-Za-z]/.test(word))
  .slice(0, 2)
  .map((word) => word[0]!.toUpperCase())
  .join("");
