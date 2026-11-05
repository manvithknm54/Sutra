import { randomUUID } from "node:crypto";

const ANCHOR = "2026-11-03"; // last working day before the demo

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function weekdaysEnding(anchor, n) {
  const out = [], d = new Date(`${anchor}T00:00:00Z`);
  while (out.length < n) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out.reverse();
}
// Picks exactly `count` absences. `decline` makes recent sessions more likely, so trends show a drop.
function pickAbsent(rng, T, count, decline) {
  const w = Array.from({ length: T }, (_, i) => (decline ? 0.2 + (i / T) ** 3 * 3 : 1));
  const chosen = new Set();
  while (chosen.size < count) {
    let total = 0;
    for (let i = 0; i < T; i++) if (!chosen.has(i)) total += w[i];
    let r = rng() * total;
    for (let i = 0; i < T; i++) {
      if (chosen.has(i)) continue;
      r -= w[i];
      if (r <= 0) { chosen.add(i); break; }
    }
  }
  return chosen;
}
function targetPresent(rollNo, i, T) {
  if (rollNo === "ENG-24-CSE-0412") return 163;  // 81.5% of 200 (brief sample)
  if (rollNo === "ENG-24-ME-0177") return 30;    // 68.2% of 44  (brief sample)
  let pct;
  if (i === 4) pct = 70;                          // a minor whose guardian consent is pending
  else if (i % 10 === 3) pct = 66 + (i % 7);      // shortage group
  else if (i % 13 === 6) pct = 72 + (i % 3);      // borderline, still below 75
  else pct = 84 + ((i * 7) % 13);                 // healthy, 84 to 96
  return Math.round((T * pct) / 100);
}

export async function seedAttendance(prisma) {
  const allocs = await prisma.courseAllocation.findMany({
    include: { subject: { include: { programme: true } } },
    orderBy: [{ batchId: "asc" }, { subject: { code: "asc" } }],
  });
  const byBatch = new Map();
  for (const a of allocs) byBatch.set(a.batchId, [...(byBatch.get(a.batchId) ?? []), a]);

  const days = weekdaysEnding(ANCHOR, 80);
  let sCount = 0, rCount = 0;

  for (const [batchId, list] of byBatch) {
    const sessions = [];
    list.forEach((a, k) => {
      const n = a.subject.programme.code === "ME" ? 44 : 50;
      days.filter((_, j) => (j + k) % 5 !== 4).slice(-n).forEach((d) => {
        const hh = String(9 + k).padStart(2, "0");
        sessions.push({
          id: randomUUID(), allocationId: a.id, date: new Date(`${d}T00:00:00Z`), period: k + 1,
          markedById: a.facultyId,
          deviceTime: new Date(`${d}T${hh}:05:00+05:30`), serverTime: new Date(`${d}T${hh}:07:00+05:30`),
        });
      });
    });
    sessions.sort((x, y) => x.date - y.date || x.period - y.period);
    await prisma.attendanceSession.createMany({ data: sessions });
    sCount += sessions.length;

    const T = sessions.length;
    const students = await prisma.student.findMany({ where: { batchId }, orderBy: { rollNo: "asc" } });
    const rows = [];
    for (const s of students) {
      const base = s.rollNo.includes("-CSE-") ? 400 : 170;
      const i = Number(s.rollNo.slice(-4)) - base;
      const P = targetPresent(s.rollNo, i, T);
      const seed = [...s.rollNo].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
      const absent = pickAbsent(mulberry32(seed), T, T - P, P / T < 0.76);
      sessions.forEach((x, idx) =>
        rows.push({ sessionId: x.id, studentId: s.id, status: absent.has(idx) ? "ABSENT" : "PRESENT" }));
    }
    for (let c = 0; c < rows.length; c += 4000)
      await prisma.attendanceRecord.createMany({ data: rows.slice(c, c + 4000) });
    rCount += rows.length;
  }
  console.log(`Attendance history: ${sCount} sessions, ${rCount} records.`);
}