export const THRESHOLD_PCT = 75;   // from the brief: alert below 75%
export const MIN_SESSIONS = 10;    // assumption: don't judge a student on fewer sessions
export const MAX_LATE_DAYS = 14;   // assumption: an offline phone may sync up to 14 days late

// Integer maths, so 75.0% is never flagged and 74.9% always is. No float rounding.
export const isShortage = (present, total) => total > 0 && present * 100 < total * THRESHOLD_PCT;
export const percent = (present, total) => (total ? Math.round((present * 1000) / total) / 10 : null);

const IST_MS = 330 * 60 * 1000;
export const istNow = () => new Date(Date.now() + IST_MS);
export const todayIST = () => istNow().toISOString().slice(0, 10);
export const daysBetween = (a, b) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

// ISO week, so an alert is sent at most once per student per week.
export function weekKey(d = istNow()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, "0")}`;
}

// Decides what the server does with one synced session. Pure, so it is unit tested.
//  byId   = session already stored under this client id  (or null)
//  bySlot = a different session already holding the same class+date+period (or null)
export function classify({ byId, bySlot, absent, userId, date, today }) {
  if (byId) {
    const prev = new Set(byId.absentIds);
    const same = prev.size === absent.length && absent.every((id) => prev.has(id));
    if (same) return "duplicate"; // a retry or double-send: safe no-op
    return byId.markedById === userId && date === today ? "update" : "conflict";
  }
  if (bySlot) return "conflict"; // another device already marked this period
  return "create";
}