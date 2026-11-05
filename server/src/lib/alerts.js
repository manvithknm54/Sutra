import { prisma } from "../db.js";
import { MIN_SESSIONS, THRESHOLD_PCT, isShortage, istNow, percent, weekKey } from "./attendance.js";

// Odia text needs review by a native speaker before launch (noted in the TDD).
export const messageFor = (name, pct) => ({
  en: `Dear Guardian, ${name}'s attendance is ${pct}%, below the required ${THRESHOLD_PCT}%. Please contact the college.`,
  od: `ଆପଣଙ୍କ ପୁଅ/ଝିଅ ${name} ର ଉପସ୍ଥିତି ${pct}% ଅଟେ, ଯାହା ${THRESHOLD_PCT}% ରୁ କମ୍। ଦୟାକରି କଲେଜ ସହ ଯୋଗାଯୋଗ କରନ୍ତୁ।`,
});

export async function runShortageAlerts(campusId, { db = prisma, now = istNow() } = {}) {
  const grouped = await db.attendanceRecord.groupBy({
    by: ["studentId", "status"],
    where: { student: { campusId } },
    _count: { _all: true },
  });
  const tally = new Map();
  for (const g of grouped) {
    const t = tally.get(g.studentId) ?? { present: 0, total: 0 };
    t.total += g._count._all;
    if (g.status === "PRESENT") t.present += g._count._all;
    tally.set(g.studentId, t);
  }
  const low = [...tally].filter(([, t]) => t.total >= MIN_SESSIONS && isShortage(t.present, t.total));
  if (!low.length) return { created: 0 };

  const students = await db.student.findMany({
    where: { id: { in: low.map(([id]) => id) } },
    select: { id: true, name: true, guardianPhone: true, isMinor: true, guardianConsent: true },
  });
  const wk = weekKey(now);
  const rows = [];
  for (const s of students) {
    if (!s.guardianPhone) continue;
    const t = tally.get(s.id);
    const m = messageFor(s.name, percent(t.present, t.total));
    const held = s.isMinor && !s.guardianConsent; // DPDP: no message to a minor's guardian without consent
    rows.push({
      studentId: s.id, weekKey: wk, channel: "MOCK_SMS", language: "EN+OD",
      kind: held ? "SHORTAGE_HELD" : "SHORTAGE",
      body: held ? `Held: guardian consent pending. Would send: ${m.en}` : `${m.en}\n${m.od}`,
    });
  }
  // unique(studentId, kind, weekKey) + skipDuplicates = safe to run any number of times
  const r = await db.alertLog.createMany({ data: rows, skipDuplicates: true });
  return { created: r.count };
}