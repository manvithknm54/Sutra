import { z } from "zod";
import { studyYear } from "./fees.js";

export const SpecSchema = z.object({
  select: z.enum(["list", "count"]).default("list"),
  programme: z.string().trim().min(1).max(10).toUpperCase().optional(),
  studyYear: z.number().int().min(1).max(4).optional(),
  attendanceBelow: z.number().min(1).max(100).optional(),
  attendanceAtLeast: z.number().min(0).max(100).optional(),
  period: z.enum(["all", "this_month", "last_4_weeks"]).default("all"),
  feeStatus: z.enum(["due", "overdue", "critical", "cleared"]).optional(),
  minDueRupees: z.number().int().min(1).max(10_000_000).optional(),
  atRisk: z.boolean().optional(),
  riskLevel: z.enum(["high", "medium"]).optional(),
  minor: z.boolean().optional(),
  consentPending: z.boolean().optional(),
  category: z.enum(["GENERAL", "OBC", "SC", "ST", "EWS"]).optional(),
  sortBy: z.enum(["attendance", "due", "name", "risk"]).optional(),
});

const KEYS = Object.keys(SpecSchema.shape);
const FILTERS = ["programme", "studyYear", "attendanceBelow", "attendanceAtLeast", "feeStatus", "minDueRupees", "atRisk", "riskLevel", "minor", "consentPending", "category"];
export const hasFilters = (s) => FILTERS.some((k) => (k === "atRisk" || k === "consentPending" ? s[k] === true : s[k] != null));

export function specFromModel(raw) {
  const picked = Object.fromEntries(KEYS.filter((k) => raw[k] != null).map((k) => [k, raw[k]]));
  const r = SpecSchema.safeParse(picked);
  return r.success ? r.data : null;
}

const YEAR = { first: 1, "1st": 1, second: 2, "2nd": 2, third: 3, "3rd": 3, fourth: 4, "4th": 4, final: 4 };
const WRITE = /\b(delete|remove|drop|update|edit|modify|insert|erase|truncate|waive|forgive)\b/;

export function ruleParse(question, programmes = []) {
  const t = ` ${question.toLowerCase().replace(/[?!]/g, " ").replace(/(?<!\d),|,(?!\d)/g, " ")} `;
  if (WRITE.test(t)) return null;
  const spec = { select: /\b(how many|count|number of)\b/.test(t) ? "count" : "list", period: "all" };

  for (const p of programmes) {
    const words = p.name.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 6 && !["engineering", "technology"].includes(w));
    if (new RegExp(`\\b${p.code}\\b`, p.code.length >= 3 ? "i" : "").test(question) || words.some((w) => t.includes(` ${w} `))) {
      spec.programme = p.code.toUpperCase(); break;
    }
  }

  let m = t.match(/\b(first|second|third|fourth|final|1st|2nd|3rd|4th)[- ]year\b/);
  if (m) spec.studyYear = YEAR[m[1]];
  else if ((m = t.match(/\byear[- ]?([1-4])\b/)) || (m = t.match(/\b([1-4])[- ]year\b/))) spec.studyYear = Number(m[1]);

  const attCtx = /attendance|present|absent|shortage|detain/.test(t) || t.includes("%");
  const below = t.match(/\b(below|under|less than|lower than|beneath)\s+(\d{1,3}(?:\.\d+)?)(?![\d,])/);
  const atLeast = t.match(/\b(above|over|at least|more than|minimum of|greater than)\s+(\d{1,3}(?:\.\d+)?)\s*(?:%|percent|per cent)/);
  if (below && attCtx && Number(below[2]) >= 1 && Number(below[2]) <= 100) spec.attendanceBelow = Number(below[2]);
  else if (/shortage|detain|short of attendance/.test(t)) spec.attendanceBelow = 75;
  if (atLeast && attCtx && Number(atLeast[2]) <= 100) spec.attendanceAtLeast = Number(atLeast[2]);

  if (/\bthis month\b/.test(t)) spec.period = "this_month";
  else if (/\b(last|past) (4|four) weeks\b|\blast month\b|\bpast month\b|\blast 30 days\b/.test(t)) spec.period = "last_4_weeks";

  const feeCtx = /\b(fee|fees|due|dues|unpaid|outstanding|owe|owes|owing|defaulters?|overdue|balance)\b/.test(t);
  if (/\b(cleared|no dues|fully paid|paid up|paid in full)\b/.test(t)) spec.feeStatus = "cleared";
  else if (/\bdefaulters?\b/.test(t) || (feeCtx && /\bcritical\b/.test(t))) spec.feeStatus = "critical";
  else if (/\boverdue\b/.test(t)) spec.feeStatus = "overdue";
  else if (feeCtx) spec.feeStatus = "due";

  if (feeCtx && spec.feeStatus !== "cleared") {
    const mm = t.match(/\b(?:more than|over|above|greater than|at least|exceeding)\s*(?:₹|rs\.?|inr)?\s*(\d[\d,]*)(?:\s*(k|thousand|lakhs?))?/i);
    if (mm && !t.slice(mm.index + mm[0].length).trimStart().startsWith("%")) {
      let v = Number(mm[1].replace(/,/g, ""));
      if (mm[2] === "k" || mm[2] === "thousand") v *= 1000; else if (mm[2]?.startsWith("lakh")) v *= 100000;
      if (v > 100) spec.minDueRupees = Math.round(v);
    }
  }

  if (/\bhigh[- ]risk\b/.test(t)) { spec.atRisk = true; spec.riskLevel = "high"; }
  else if (/\bmedium[- ]risk\b/.test(t)) { spec.atRisk = true; spec.riskLevel = "medium"; }
  else if (/\bat[- ]risk\b|\brisk\b|\bmentor\b|\bflagged\b/.test(t)) spec.atRisk = true;

  if (/\bconsent\b/.test(t)) { if (/on file|given|received|recorded/.test(t)) spec.minor = true; else spec.consentPending = true; }
  else if (/\bminors?\b/.test(t)) spec.minor = true;

  const cat = t.match(/\b(sc|st|obc|ews)\b/);
  if (cat) spec.category = cat[1].toUpperCase(); else if (/\bgeneral category\b/.test(t)) spec.category = "GENERAL";

  spec.sortBy = spec.attendanceBelow != null || spec.attendanceAtLeast != null ? "attendance" : spec.feeStatus ? "due" : spec.atRisk ? "risk" : undefined;
  const everyone = /\b(all|every|total)\b.*\bstudents\b|\bhow many students\b/.test(t);
  if (!hasFilters(spec) && !everyone) return null;
  return SpecSchema.parse(spec);
}

const PERIOD = { all: "all sessions this term", this_month: "this month", last_4_weeks: "the last 4 weeks" };

export function describeSpec(s) {
  const c = [];
  if (s.programme) c.push(["Programme", s.programme]);
  if (s.studyYear) c.push(["Study year", `Year ${s.studyYear}`]);
  if (s.attendanceBelow != null) c.push(["Attendance", `below ${s.attendanceBelow}%`]);
  if (s.attendanceAtLeast != null) c.push(["Attendance", `${s.attendanceAtLeast}% or more`]);
  if (s.attendanceBelow != null || s.attendanceAtLeast != null) c.push(["Period", PERIOD[s.period]]);
  if (s.feeStatus) c.push(["Fees", { due: "has dues", overdue: "overdue", critical: "critical, over 60 days", cleared: "cleared" }[s.feeStatus]]);
  if (s.minDueRupees) c.push(["Due at least", `₹${s.minDueRupees.toLocaleString("en-IN")}`]);
  if (s.atRisk) c.push(["At risk", "open flag"]);
  if (s.riskLevel) c.push(["Risk level", s.riskLevel]);
  if (s.minor != null) c.push(["Minor", s.minor ? "yes" : "no"]);
  if (s.consentPending) c.push(["Guardian consent", "pending"]);
  if (s.category) c.push(["Category", s.category]);
  return c;
}

const FEE_OK = {
  due: (f) => f.due > 0, overdue: (f) => f.status === "OVERDUE" || f.status === "CRITICAL",
  critical: (f) => f.status === "CRITICAL", cleared: (f) => f.due <= 0,
};
const SORT = {
  attendance: (a, b) => (a.attendancePct ?? 101) - (b.attendancePct ?? 101), due: (a, b) => b.due - a.due,
  risk: (a, b) => (b.risk ?? -1) - (a.risk ?? -1), name: (a, b) => a.name.localeCompare(b.name),
};

export function evaluate(spec, { students, att, feeBy, riskBy, minSessions, term, levelOf }) {
  const filterAtt = spec.attendanceBelow != null || spec.attendanceAtLeast != null;
  const years = new Set();
  let notEnough = 0;
  const rows = [];
  for (const s of students) {
    const year = studyYear(s.batch.startYear, term);
    years.add(year);
    if (spec.programme && s.batch.programme.code !== spec.programme) continue;
    if (spec.studyYear && year !== spec.studyYear) continue;
    if (spec.category && s.category !== spec.category) continue;
    if (spec.minor != null && s.isMinor !== spec.minor) continue;
    if (spec.consentPending && !(s.isMinor && !s.guardianConsent)) continue;

    const a = att.get(s.id) ?? { present: 0, total: 0 };
    if (filterAtt) {
      if (a.total < minSessions) { notEnough++; continue; }
      if (spec.attendanceBelow != null && !(a.present * 100 < a.total * spec.attendanceBelow)) continue;
      if (spec.attendanceAtLeast != null && !(a.present * 100 >= a.total * spec.attendanceAtLeast)) continue;
    }
    const f = feeBy.get(s.id) ?? { due: 0, status: "CLEARED" };
    if (spec.feeStatus && !FEE_OK[spec.feeStatus](f)) continue;
    if (spec.minDueRupees && !(f.due >= spec.minDueRupees * 100)) continue;
    const risk = riskBy.get(s.id) ?? null;
    if (spec.atRisk && risk == null) continue;
    if (spec.riskLevel && (risk == null || levelOf(risk) !== spec.riskLevel)) continue;

    rows.push({
      id: s.id, rollNo: s.rollNo, name: s.name, programme: s.batch.programme.code, year,
      attendancePct: a.total ? Math.round((a.present * 1000) / a.total) / 10 : null,
      due: Math.max(f.due, 0), feeStatus: f.status, risk,
    });
  }
  if (SORT[spec.sortBy]) rows.sort(SORT[spec.sortBy]);
  return { rows, notEnough, years: [...years].sort() };
}