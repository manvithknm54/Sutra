export const CURRENT_TERM = "2026-27";
// The public address of the app, reduced to scheme + host so a pasted "…/login" or trailing slash can't break links.
export function publicOrigin() {
  const raw = (process.env.CLIENT_ORIGIN ?? "").trim();
  try { return new URL(raw).origin; } catch { return raw.replace(/\/+$/, ""); }
}