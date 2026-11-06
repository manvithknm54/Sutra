// studentId -> { present, total }. With `since` (YYYY-MM-DD) it covers only recent sessions.
export async function tallyAttendance(db, campusId, { since } = {}) {
  const where = { student: { campusId }, ...(since ? { session: { date: { gte: new Date(`${since}T00:00:00Z`) } } } : {}) };
  const g = await db.attendanceRecord.groupBy({ by: ["studentId", "status"], where, _count: { _all: true } });
  const m = new Map();
  for (const r of g) {
    const t = m.get(r.studentId) ?? { present: 0, total: 0 };
    t.total += r._count._all;
    if (r.status === "PRESENT") t.present += r._count._all;
    m.set(r.studentId, t);
  }
  return m;
}