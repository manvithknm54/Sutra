import { prisma } from "../db.js";
import { dueOf, overdueDays, receiptLabel, statusOf } from "./fees.js";
import { todayIST } from "./attendance.js";
import { cached } from "./cache.js";

// A database sequence, so two receipts can never get the same number.
export async function nextReceiptNo(db = prisma) {
  const [{ n }] = await db.$queryRaw`SELECT nextval('receipt_seq')::int AS n`;
  return receiptLabel(n, todayIST().slice(0, 4));
}

// studentId -> { charge, payment, scholarship, dueDate }, summed inside the database.
export async function ledgerTotals(db, where) {
  const g = await db.feeLedgerEntry.groupBy({
    by: ["studentId", "type"], where, _sum: { amountPaise: true }, _min: { dueDate: true },
  });
  const m = new Map();
  for (const r of g) {
    const t = m.get(r.studentId) ?? { charge: 0, payment: 0, scholarship: 0, dueDate: null };
    t[r.type.toLowerCase()] = r._sum.amountPaise ?? 0;
    if (r.type === "CHARGE" && r._min.dueDate) t.dueDate = r._min.dueDate.toISOString().slice(0, 10);
    m.set(r.studentId, t);
  }
  return m;
}

export async function feeRows(db, campusId, today = todayIST()) {
  const [students, totals] = await Promise.all([
    db.student.findMany({
      where: { campusId }, orderBy: { rollNo: "asc" },
      select: { id: true, rollNo: true, name: true, category: true,
        batch: { select: { label: true, programmeId: true, programme: { select: { code: true } } } } },
    }),
    ledgerTotals(db, { student: { campusId } }),
  ]);
  return students.map((s) => {
    const t = totals.get(s.id) ?? {};
    const due = dueOf(t);
    const days = due > 0 ? overdueDays(t.dueDate, today) : 0;
    return {
      studentId: s.id, rollNo: s.rollNo, name: s.name, category: s.category,
      programmeId: s.batch.programmeId, programme: s.batch.programme.code, batch: s.batch.label,
      billed: t.charge ?? 0, scholarship: t.scholarship ?? 0, paid: t.payment ?? 0,
      due, dueDate: t.dueDate ?? null, overdueDays: days, status: statusOf(due, days),
    };
  });
}

export const feeRowsCached = (campusId, today = todayIST()) => cached(campusId, `fees:${today}`, () => feeRows(prisma, campusId, today));