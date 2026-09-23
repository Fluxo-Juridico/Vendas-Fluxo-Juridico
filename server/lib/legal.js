export const TERMS_VERSION = "2026-09-23";
export const PRIVACY_VERSION = "2026-09-23";

export function acceptedLegalTerms(value) {
  return value === true || ["true", "1", "on", "yes"].includes(String(value || "").toLowerCase());
}
