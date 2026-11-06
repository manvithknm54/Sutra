import { Router } from "express";
import { prisma } from "../db.js";
import { MIN_SESSIONS, isShortage, percent } from "../lib/attendance.js";
import { tallyAttendance } from "../lib/attendanceData.js";
import { feeRows } from "../lib/feeData.js";
import { HIGH_AT } from "../lib/risk.js";

const router = Router();

router.get("/", async (req, res) => {
  const c = req.user.campusId;
  const [students, faculty, fees, att, marks, flags, subjects] = await Promise.all([
    prisma.student.count({ where: { campusId: c } }),
    prisma.user.count({ where: { campusId: c, role: "FACULTY" } }),
    feeRows(prisma, c),
    tallyAttendance(prisma, c),
    prisma.courseAllocation.groupBy({ by: ["marksStatus"], where: { subject: { programme: { campusId: c } } }, _count: { _all: true } }),
    prisma.riskFlag.findMany({ where: { status: "OPEN", student: { campusId: c } }, select: { score: true } }),
    prisma.$queryRaw`
      SELECT sub.code, sub.name, COUNT(*)::int AS total,
             SUM(CASE WHEN r.status = 'PRESENT' THEN 1 ELSE 0 END)::int AS present
      FROM "AttendanceRecord" r
      JOIN "AttendanceSession" s ON s.id = r."sessionId"
      JOIN "CourseAllocation" a ON a.id = s."allocationId"
      JOIN "Subject" sub ON sub.id = a."subjectId"
      JOIN "Programme" p ON p.id = sub."programmeId"
      WHERE p."campusId" = ${c}
      GROUP BY sub.code, sub.name
      ORDER BY sub.code`,
  ]);

  let present = 0, total = 0, shortage = 0;
  for (const t of att.values()) { present += t.present; total += t.total; if (t.total >= MIN_SESSIONS && isShortage(t.present, t.total)) shortage++; }
  const sum = (a, k) => a.reduce((n, r) => n + r[k], 0);
  const owing = fees.filter((r) => r.due > 0), crit = fees.filter((r) => r.status === "CRITICAL");

  res.json({
    students, faculty, shortage, attendancePct: percent(present, total),
    fees: { billed: sum(fees, "billed"), scholarship: sum(fees, "scholarship"), paid: sum(fees, "paid"),
      outstanding: sum(owing, "due"), owingCount: owing.length, critical: sum(crit, "due"), criticalCount: crit.length },
    marks: Object.fromEntries(marks.map((m) => [m.marksStatus, m._count._all])),
    risk: { open: flags.length, high: flags.filter((f) => f.score >= HIGH_AT).length },
    subjects: subjects.map((s) => ({ code: s.code, name: s.name, pct: percent(s.present, s.total), total: s.total })),
  });
});

export default router;