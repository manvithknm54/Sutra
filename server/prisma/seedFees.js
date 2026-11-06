import { nextReceiptNo } from "../src/lib/feeData.js";
import { studyYear, toPaise } from "../src/lib/fees.js";

const TERM = "2026-27";
// Annual fee in rupees by programme and category. Assumption: the brief gives no amounts, so these are illustrative.
const STRUCT = {
  CSE: { GENERAL: 120000, OBC: 120000, EWS: 100000, SC: 60000, ST: 60000 },
  ME: { GENERAL: 100000, OBC: 100000, EWS: 85000, SC: 50000, ST: 50000 },
};
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 13);
const unit = (s) => (Math.abs(hash(s)) % 1000) / 1000; // deterministic 0..1

export async function seedFees(prisma) {
  const structRows = [];
  for (const p of await prisma.programme.findMany())
    for (const [category, rupees] of Object.entries(STRUCT[p.code]))
      for (let y = 1; y <= p.years; y++) structRows.push({ programmeId: p.id, category, yearNo: y, amountPaise: toPaise(rupees) });
  await prisma.feeStructure.createMany({ data: structRows });

  let n = 0;
  for (const b of await prisma.batch.findMany()) {
    const year = studyYear(b.startYear, TERM);
    const amt = new Map(structRows.filter((r) => r.programmeId === b.programmeId && r.yearNo === year).map((r) => [r.category, r.amountPaise]));
    const students = await prisma.student.findMany({ where: { batchId: b.id }, orderBy: { rollNo: "asc" } });

    await prisma.feeLedgerEntry.createMany({
      data: students.map((s, i) => ({
        studentId: s.id, type: "CHARGE", amountPaise: amt.get(s.category), note: `Tuition fee ${TERM}`,
        idempotencyKey: `charge:${s.id}:${TERM}`, dueDate: new Date(`${i % 3 === 0 ? "2026-08-31" : "2026-10-15"}T00:00:00Z`),
        at: new Date("2026-08-01T10:00:00+05:30"),
      })),
    });

    for (const [i, s] of students.entries()) {
      const charge = amt.get(s.category);
      const special = s.rollNo === "ENG-24-CSE-0412" || s.rollNo === "ENG-24-ME-0177";
      const scholarship = !special && i % 11 === 5 ? toPaise(10000) : 0;
      if (scholarship)
        await prisma.feeLedgerEntry.create({ data: { studentId: s.id, type: "SCHOLARSHIP", amountPaise: scholarship, note: "Merit scholarship",
          idempotencyKey: `sch:${s.id}:${TERM}`, at: new Date("2026-08-05T10:00:00+05:30") } });

      const payable = charge - scholarship, r = unit(s.rollNo + "fee");
      let plan;
      if (s.rollNo === "ENG-24-CSE-0412") plan = [toPaise(40000), toPaise(20000)];       // Subhashree: fully paid, Rs 0 due
      else if (s.rollNo === "ENG-24-ME-0177") plan = [toPaise(25000), toPaise(15000)];   // Ankit: Rs 85,000 - 40,000 = Rs 45,000 due
      else if (r < 0.55) { const first = Math.round((payable * 0.6) / 50000) * 50000; plan = [first, payable - first]; }
      else if (r < 0.8) { const part = Math.round((payable * (0.35 + 0.4 * unit(s.rollNo))) / 50000) * 50000; plan = [Math.max(50000, Math.min(part, payable - 50000))]; }
      else plan = [];

      for (const [k, paise] of plan.entries()) {
        n++;
        const day = String(8 + ((n * 3) % 20)).padStart(2, "0");
        const method = ["COUNTER", "UPI", "BANK"][n % 3];
        await prisma.feeLedgerEntry.create({
          data: { studentId: s.id, type: "PAYMENT", amountPaise: paise, method, reference: method === "COUNTER" ? null : `${method}${100000 + n}`,
            note: "Payment received", idempotencyKey: `seed:pay:${s.id}:${k}`, receiptNo: await nextReceiptNo(prisma),
            at: new Date(`2026-09-${day}T11:${String(10 + (n % 40)).padStart(2, "0")}:00+05:30`) },
        });
      }
    }
  }
  console.log(`Fees seeded: structures, one charge per student, ${n} payments.`);
}