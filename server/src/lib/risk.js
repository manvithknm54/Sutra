import { prisma } from "../db.js";
import { MIN_SESSIONS, isShortage, istNow } from "./attendance.js";
import { tallyAttendance } from "./attendanceData.js";
import { publish } from "./events.js";

export const FLAG_AT = 35, HIGH_AT = 60;          // assumptions, labelled in the TDD
export const TREND_DAYS = 28, MIN_RECENT = 8, REFLAG_DAYS = 14;
export const levelOf = (s) => (s >= HIGH_AT ? "HIGH" : s >= FLAG_AT ? "MEDIUM" : "NONE");
const pct1 = (a, b) => Math.round((a * 1000) / b) / 10;

// att/recent = { present, total }; marks = { pct, classAvg } or null. Pure, so it is unit tested.
export function scoreStudent({ att, recent, marks }) {
  const items = [], signals = {};
  const add = (kind, points, text) => items.push({ kind, points, text });
  const hasAtt = att.total >= MIN_SESSIONS;
  if (!hasAtt && !marks) return { insufficient: true, score: 0, level: "NONE", items, signals };

  if (hasAtt) {
    const p = pct1(att.present, att.total);
    signals.attendancePct = p; signals.sessions = att.total;
    if (att.present * 100 < att.total * 65) add("ATTENDANCE_LOW", 40, `Attendance ${p}%, well below the required 75%`);
    else if (isShortage(att.present, att.total)) add("ATTENDANCE_LOW", 30, `Attendance ${p}%, below the required 75%`);
    else if (att.present * 100 < att.total * 80) add("ATTENDANCE_WATCH", 10, `Attendance ${p}%, close to the 75% limit`);

    const eT = att.total - recent.total, eP = att.present - recent.present;
    if (recent.total >= MIN_RECENT && eT >= MIN_SESSIONS) {
      const r = pct1(recent.present, recent.total), e = pct1(eP, eT);
      signals.recentPct = r; signals.earlierPct = e;
      const drop = Math.round((e - r) * 10) / 10;
      if (drop >= 15) add("ATTENDANCE_TREND", 20, `Attendance fell ${drop} points in the last 4 weeks (${e}% to ${r}%)`);
      else if (drop >= 8) add("ATTENDANCE_TREND", 10, `Attendance slipped ${drop} points in the last 4 weeks (${e}% to ${r}%)`);
    }
  }
  if (marks) {
    signals.marksPct = marks.pct; signals.classAvgPct = marks.classAvg;
    if (marks.pct < 40) add("MARKS_LOW", 30, `Internal marks ${marks.pct}%, below 40%`);
    else if (marks.pct < 50) add("MARKS_LOW", 20, `Internal marks ${marks.pct}%, below 50%`);
    else if (marks.pct < 60) add("MARKS_LOW", 10, `Internal marks ${marks.pct}%, below 60%`);
    if (marks.classAvg != null && marks.classAvg - marks.pct >= 15)
      add("MARKS_GAP", 10, `${Math.round((marks.classAvg - marks.pct) * 10) / 10} points below the class average of ${marks.classAvg}%`);
  }
  const score = Math.min(100, items.reduce((n, i) => n + i.points, 0));
  return { insufficient: false, score, level: levelOf(score), items, signals };
}

const lastScan = new Map();
export const getLastScan = (campusId) => lastScan.get(campusId) ?? null;

export async function runRiskScan(campusId, { db = prisma, now = istNow() } = {}) {
  const since = new Date(now.getTime() - TREND_DAYS * 864e5).toISOString().slice(0, 10);
  const inCampus = { subject: { programme: { campusId } } };
  const [students, overall, recent, comps, entries, allocs, existing] = await Promise.all([
    db.student.findMany({ where: { campusId }, select: { id: true, batchId: true, rollNo: true } }),
    tallyAttendance(db, campusId),
    tallyAttendance(db, campusId, { since }),
    db.markComponent.findMany({ where: { allocation: inCampus }, select: { id: true, allocationId: true, maxMarks: true } }),
    db.markEntry.findMany({ where: { component: { allocation: inCampus } }, select: { studentId: true, componentId: true, rawMarks: true, moderationDelta: true } }),
    db.courseAllocation.findMany({ where: inCampus, select: { batchId: true, facultyId: true } }),
    db.riskFlag.findMany({ where: { student: { campusId } }, select: { id: true, studentId: true, status: true, updatedAt: true } }),
  ]);

  // Internal marks per student, counting only sheets where that student has every component.
  const compOf = new Map(comps.map((c) => [c.id, c]));
  const perAlloc = new Map();
  for (const c of comps) { const a = perAlloc.get(c.allocationId) ?? { count: 0, max: 0 }; a.count++; a.max += c.maxMarks; perAlloc.set(c.allocationId, a); }
  const sums = new Map();
  for (const e of entries) {
    const k = `${e.studentId}:${compOf.get(e.componentId).allocationId}`;
    const s = sums.get(k) ?? { n: 0, total: 0 };
    s.n++; s.total += Number(e.rawMarks) + Number(e.moderationDelta); sums.set(k, s);
  }
  const stuMarks = new Map();
  for (const [k, s] of sums) {
    const [sid, aid] = k.split(":");
    const a = perAlloc.get(aid);
    if (s.n !== a.count) continue;
    const m = stuMarks.get(sid) ?? { total: 0, max: 0 };
    m.total += s.total; m.max += a.max; stuMarks.set(sid, m);
  }
  const pctOf = new Map([...stuMarks].map(([id, m]) => [id, pct1(m.total, m.max)]));
  const byBatch = new Map();
  for (const s of students) { const p = pctOf.get(s.id); if (p != null) byBatch.set(s.batchId, [...(byBatch.get(s.batchId) ?? []), p]); }
  const avgOf = (b) => { const l = byBatch.get(b); return l?.length ? Math.round((l.reduce((x, y) => x + y, 0) / l.length) * 10) / 10 : null; };

  // Assumption: a student's mentor is one of the faculty teaching their batch, spread evenly by roll number.
  const facByBatch = new Map();
  for (const a of allocs) facByBatch.set(a.batchId, new Set([...(facByBatch.get(a.batchId) ?? []), a.facultyId]));
  const fallback = (await db.user.findFirst({ where: { campusId, role: "FACULTY" }, orderBy: { id: "asc" }, select: { id: true } }))?.id;
  const mentorFor = (s) => {
    const list = [...(facByBatch.get(s.batchId) ?? [])].sort();
    return list.length ? list[(Number(s.rollNo.slice(-4)) || 0) % list.length] : fallback;
  };

  const openBy = new Map(existing.filter((f) => f.status === "OPEN").map((f) => [f.studentId, f]));
  const cooling = new Set(existing.filter((f) => f.status === "DISMISSED" && Date.now() - f.updatedAt.getTime() < REFLAG_DAYS * 864e5).map((f) => f.studentId));
  const out = { assessed: 0, insufficient: 0, flagged: 0, high: 0, created: 0, refreshed: 0 };

  for (const s of students) {
    const r = scoreStudent({
      att: overall.get(s.id) ?? { present: 0, total: 0 }, recent: recent.get(s.id) ?? { present: 0, total: 0 },
      marks: stuMarks.has(s.id) ? { pct: pctOf.get(s.id), classAvg: avgOf(s.batchId) } : null,
    });
    if (r.insufficient) { out.insufficient++; continue; }
    out.assessed++;
    if (r.score < FLAG_AT) continue;
    out.flagged++; if (r.level === "HIGH") out.high++;
    const reasons = { items: r.items, signals: r.signals };
    const open = openBy.get(s.id);
    if (open) { await db.riskFlag.update({ where: { id: open.id }, data: { score: r.score, reasons } }); out.refreshed++; continue; }
    if (cooling.has(s.id)) continue;
    const mentorId = mentorFor(s);
    if (!mentorId) continue;
    await db.riskFlag.create({ data: { studentId: s.id, score: r.score, reasons, task: { create: { mentorId } } } });
    out.created++;
  }
  lastScan.set(campusId, { ...out, at: new Date().toISOString() });
  return out;
}

// Debounced: a burst of attendance or marks edits triggers one scan, not fifty.
const timers = new Map();
export function scheduleRiskScan(campusId, delay = 15000) {
  clearTimeout(timers.get(campusId));
  timers.set(campusId, setTimeout(async () => {
    timers.delete(campusId);
    try { await runRiskScan(campusId); publish(campusId, ["risk"]); } catch (e) { console.error("risk scan failed", e); }
  }, delay));
}