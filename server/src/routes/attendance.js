import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireRole } from "../middleware/auth.js";
import { MAX_LATE_DAYS, MIN_SESSIONS, classify, daysBetween, isShortage, percent, todayIST } from "../lib/attendance.js";
import { runShortageAlerts } from "../lib/alerts.js";

const router = Router();
router.use(requireRole("FACULTY"));

// Class list plus each student's overall attendance, for the marking screen.
router.get("/roster/:allocationId", async (req, res) => {
  const { user } = req;
  const alloc = await prisma.courseAllocation.findFirst({
    where: { id: req.params.allocationId, facultyId: user.id, subject: { programme: { campusId: user.campusId } } },
    include: {
      subject: { select: { code: true, name: true, semester: true } },
      batch: { select: { label: true, programme: { select: { code: true } } } },
    },
  });
  if (!alloc) return res.status(404).json({ error: "Class not found" });

  const today = todayIST();
  const students = await prisma.student.findMany({
    where: { batchId: alloc.batchId, campusId: user.campusId },
    orderBy: { rollNo: "asc" },
    select: { id: true, rollNo: true, name: true },
  });
  const ids = students.map((s) => s.id);

  const [grouped, recent, todays] = await Promise.all([
    prisma.attendanceRecord.groupBy({ by: ["studentId", "status"], where: { studentId: { in: ids } }, _count: { _all: true } }),
    prisma.attendanceSession.findMany({
      where: { allocationId: alloc.id }, orderBy: [{ date: "desc" }, { period: "desc" }], take: 3, select: { id: true },
    }),
    prisma.attendanceSession.findMany({
      where: { allocationId: alloc.id, date: new Date(`${today}T00:00:00.000Z`) }, select: { period: true },
    }),
  ]);
  const recentIds = recent.map((r) => r.id).reverse(); // oldest to newest
  const recentRecs = recentIds.length
    ? await prisma.attendanceRecord.findMany({
        where: { sessionId: { in: recentIds } }, select: { sessionId: true, studentId: true, status: true },
      })
    : [];

  const tally = new Map();
  for (const g of grouped) {
    const t = tally.get(g.studentId) ?? { present: 0, total: 0 };
    t.total += g._count._all;
    if (g.status === "PRESENT") t.present += g._count._all;
    tally.set(g.studentId, t);
  }
  const last = new Map(recentRecs.map((r) => [`${r.sessionId}:${r.studentId}`, r.status === "PRESENT" ? "P" : "A"]));

  res.json({
    allocation: { id: alloc.id, subject: alloc.subject, batch: alloc.batch },
    today,
    markedPeriods: todays.map((t) => t.period),
    students: students.map((s) => {
      const t = tally.get(s.id) ?? { present: 0, total: 0 };
      const l3 = recentIds.map((id) => last.get(`${id}:${s.id}`) ?? null);
      while (l3.length < 3) l3.unshift(null);
      return {
        ...s,
        pct: percent(t.present, t.total),
        shortage: t.total >= MIN_SESSIONS && isShortage(t.present, t.total),
        last3: l3,
      };
    }),
  });
});

const SessionIn = z.object({
  id: z.string().uuid(),                       // generated on the phone
  allocationId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period: z.number().int().min(1).max(8),
  deviceTime: z.string().datetime(),
  absentIds: z.array(z.string().min(1)).max(500),
});
const SyncBody = z.object({ sessions: z.array(SessionIn).min(1).max(50) });

async function processOne(user, s, retried = false) {
  const alloc = await prisma.courseAllocation.findFirst({
    where: { id: s.allocationId, facultyId: user.id, subject: { programme: { campusId: user.campusId } } },
    select: { id: true, batchId: true },
  });
  if (!alloc) return { id: s.id, status: "rejected", reason: "This class isn't assigned to you." };

  const today = todayIST();
  if (s.date > today) return { id: s.id, status: "rejected", reason: "Date is in the future. Check the phone's clock." };
  if (daysBetween(s.date, today) > MAX_LATE_DAYS)
    return { id: s.id, status: "rejected", reason: `Older than ${MAX_LATE_DAYS} days. Ask the office admin.` };

  const students = await prisma.student.findMany({
    where: { batchId: alloc.batchId, campusId: user.campusId }, select: { id: true },
  });
  const roster = new Set(students.map((x) => x.id));
  const absent = [...new Set(s.absentIds)];
  if (absent.some((id) => !roster.has(id)))
    return { id: s.id, status: "rejected", reason: "A listed student isn't in this class." };

  const date = new Date(`${s.date}T00:00:00.000Z`);
  const [existing, slot] = await Promise.all([
    prisma.attendanceSession.findUnique({
      where: { id: s.id },
      include: { records: { where: { status: "ABSENT" }, select: { studentId: true } } },
    }),
    prisma.attendanceSession.findUnique({
      where: { allocationId_date_period: { allocationId: s.allocationId, date, period: s.period } },
      select: { id: true },
    }),
  ]);
  if (existing && (existing.allocationId !== s.allocationId || existing.period !== s.period ||
      existing.date.toISOString().slice(0, 10) !== s.date))
    return { id: s.id, status: "rejected", reason: "This session ID is already used for another period." };

  const action = classify({
    byId: existing ? { markedById: existing.markedById, absentIds: existing.records.map((r) => r.studentId) } : null,
    bySlot: slot && slot.id !== s.id ? slot : null,
    absent, userId: user.id, date: s.date, today,
  });
  if (action === "duplicate") return { id: s.id, status: "duplicate" };
  if (action === "conflict")
    return { id: s.id, status: "conflict",
      reason: existing ? "This period was already changed by someone else." : "This period was already marked from another device." };

  const absentSet = new Set(absent);
  const rows = students.map((st) => ({
    sessionId: s.id, studentId: st.id, status: absentSet.has(st.id) ? "ABSENT" : "PRESENT",
  }));
  try {
    if (action === "create") {
      await prisma.$transaction([
        prisma.attendanceSession.create({
          data: { id: s.id, allocationId: s.allocationId, date, period: s.period, markedById: user.id, deviceTime: new Date(s.deviceTime) },
        }),
        prisma.attendanceRecord.createMany({ data: rows }),
      ]);
      return { id: s.id, status: "created" };
    }
    await prisma.$transaction([
      prisma.attendanceRecord.deleteMany({ where: { sessionId: s.id } }),
      prisma.attendanceRecord.createMany({ data: rows }),
      prisma.attendanceSession.update({ where: { id: s.id }, data: { version: { increment: 1 } } }),
    ]);
    return { id: s.id, status: "updated" };
  } catch (e) {
    // Two requests raced. Re-run once: the second pass sees the winner and classifies correctly.
    if (e?.code === "P2002" && !retried) return processOne(user, s, true);
    throw e;
  }
}

router.post("/sync", async (req, res) => {
  const p = SyncBody.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid sync payload" });

  const results = [];
  for (const s of p.data.sessions) {
    try { results.push(await processOne(req.user, s)); }
    catch (e) { console.error(e); results.push({ id: s.id, status: "error" }); } // one bad session never fails the batch
  }
  if (results.some((r) => r.status === "created" || r.status === "updated")) {
    setImmediate(() => runShortageAlerts(req.user.campusId).catch(console.error));
  }
  res.json({ results });
});

export default router;