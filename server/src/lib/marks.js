export const ACTIONS = ["SUBMIT", "RETURN", "COMPLETE_MODERATION", "LOCK", "UNLOCK_REQUEST", "UNLOCK_APPROVE", "UNLOCK_REJECT"];

// The whole workflow in one table. Assumption: the office admin acts as moderator and exam cell.
const RULES = {
  SUBMIT:              { role: "FACULTY", from: "DRAFT",     to: "SUBMITTED", owner: true },
  RETURN:              { role: "ADMIN",   from: "SUBMITTED", to: "DRAFT",     reason: true },
  COMPLETE_MODERATION: { role: "ADMIN",   from: "SUBMITTED", to: "MODERATED" },
  LOCK:                { role: "ADMIN",   from: "MODERATED", to: "LOCKED" },
  UNLOCK_REQUEST:      { role: "FACULTY", from: "LOCKED",    to: "LOCKED",    owner: true, reason: true },
  UNLOCK_APPROVE:      { role: "ADMIN",   from: "LOCKED",    to: "DRAFT",     reason: true },
  UNLOCK_REJECT:       { role: "ADMIN",   from: "LOCKED",    to: "LOCKED",    reason: true },
};

export function transition({ role, isOwner, state, action, reason }) {
  const r = RULES[action];
  if (!r) return { ok: false, code: 400, error: "Unknown action" };
  if (r.role !== role) return { ok: false, code: 403, error: "You don't have access to this action" };
  if (r.owner && !isOwner) return { ok: false, code: 403, error: "Only the assigned faculty can do this" };
  if (state !== r.from) return { ok: false, code: 409, error: `Not allowed while the marks are ${state.toLowerCase()}` };
  if (r.reason && (!reason || reason.trim().length < 5))
    return { ok: false, code: 400, error: "A reason of at least 5 characters is required" };
  return { ok: true, to: r.to };
}
export const can = (ctx) => transition({ ...ctx, reason: "valid reason" }).ok;

// Marks are in steps of 0.5 (assumption). 7.5*2 is exact in floating point, so this check is safe.
export function parseMark(v, max) {
  if (v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error("Enter a number");
  if (v < 0 || v > max) throw new Error(`Must be between 0 and ${max}`);
  if (Math.round(v * 2) !== v * 2) throw new Error("Use steps of 0.5");
  return v;
}

// Moderation can never push a mark above its component maximum or below zero.
export function effectiveDelta(raw, delta, max) {
  const target = Math.min(max, Math.max(0, raw + delta));
  return Math.round((target - raw) * 2) / 2;
}

// Stops spreadsheet formula injection from a student name like "=HYPERLINK(...)".
export function csvCell(v) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// An unlock request is pending until the next LOCK / approve / reject. Rows must be oldest first.
export function deriveUnlock(rows) {
  let s = { pending: false, reason: null, at: null };
  for (const r of rows) {
    if (r.action === "UNLOCK_REQUEST") s = { pending: true, reason: r.reason, at: r.at };
    else if (["LOCK", "UNLOCK_APPROVE", "UNLOCK_REJECT"].includes(r.action)) s = { pending: false, reason: null, at: null };
  }
  return s;
}