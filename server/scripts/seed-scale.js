import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const N = Number(process.env.N ?? 7000);
const TAG = "PERF";
const CATS = ["GENERAL", "OBC", "SC", "ST", "EWS"];

async function add() {
  const cse = await prisma.programme.findFirst({ where: { code: "CSE" } });
  const batch = await prisma.batch.upsert({
    where: { programmeId_startYear: { programmeId: cse.id, startYear: 2026 } }, update: {},
    create: { programmeId: cse.id, startYear: 2026, label: TAG },
  });
  const data = Array.from({ length: N }, (_, i) => ({
    campusId: cse.campusId, batchId: batch.id, rollNo: `ENG-26-PERF-${String(i + 1).padStart(5, "0")}`,
    name: `Load Test ${i + 1}`, category: CATS[i % 5], guardianPhone: `90${String(10000000 + i * 7).padStart(8, "0")}`,
  }));
  for (let i = 0; i < data.length; i += 2000) await prisma.student.createMany({ data: data.slice(i, i + 2000), skipDuplicates: true });

  const ids = (await prisma.student.findMany({ where: { batchId: batch.id }, select: { id: true } })).map((s) => s.id);
  const charges = ids.map((id, i) => ({ studentId: id, type: "CHARGE", amountPaise: 12000000, note: "Tuition fee 2026-27",
    idempotencyKey: `perf:charge:${id}`, dueDate: new Date(`${i % 2 ? "2026-08-31" : "2026-10-15"}T00:00:00Z`) }));
  const pays = ids.filter((_, i) => i % 5 < 3).map((id) => ({ studentId: id, type: "PAYMENT", amountPaise: 7000000, method: "UPI",
    note: "Payment received", idempotencyKey: `perf:pay:${id}` }));
  for (const rows of [charges, pays])
    for (let i = 0; i < rows.length; i += 2000) await prisma.feeLedgerEntry.createMany({ data: rows.slice(i, i + 2000), skipDuplicates: true });
  console.log(`Added ${ids.length} load-test students. Remove them with: node scripts/seed-scale.js --remove`);
}

async function remove() {
  const batch = await prisma.batch.findFirst({ where: { label: TAG } });
  if (!batch) return console.log("Nothing to remove.");
  const ids = (await prisma.student.findMany({ where: { batchId: batch.id }, select: { id: true } })).map((s) => s.id);
  for (let i = 0; i < ids.length; i += 2000) {
    const c = ids.slice(i, i + 2000);
    await prisma.mentorTask.deleteMany({ where: { flag: { studentId: { in: c } } } });
    for (const m of ["riskFlag", "alertLog", "paymentLink", "feeLedgerEntry", "consentRecord"])
      await prisma[m].deleteMany({ where: { studentId: { in: c } } });
  }
  await prisma.student.deleteMany({ where: { batchId: batch.id } });
  await prisma.batch.delete({ where: { id: batch.id } });
  console.log(`Removed ${ids.length} load-test students.`);
}

(process.argv.includes("--remove") ? remove() : add()).catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());