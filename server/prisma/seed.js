import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { seedAttendance } from "./seedAttendance.js";
import { seedMarks } from "./seedMarks.js";
import { seedFees } from "./seedFees.js";
import { runShortageAlerts, runFeeReminders } from "../src/lib/alerts.js";
import { runRiskScan } from "../src/lib/risk.js";

const prisma = new PrismaClient();
const PASSWORD = process.env.SEED_PASSWORD || "Sutra@2026"; // demo only

if (process.env.NODE_ENV === "production" && process.env.ALLOW_RESEED !== "1") {
  console.error("Refusing to reseed in production. Set ALLOW_RESEED=1 to override.");
  process.exit(1);
}

// All names and numbers below are synthetic.
const FIRST = ["Aarav","Diya","Ishaan","Kavya","Rohan","Sneha","Tanmay","Ritika","Manas","Pooja",
  "Soumya","Lopamudra","Debasis","Namita","Chinmay","Smruti","Bhaskar","Archana","Pradeep","Jyotsna"];
const LAST = ["Mishra","Nayak","Patra","Swain","Behera","Dash","Sahu","Jena","Rout","Pradhan","Mahapatra","Das"];
const CATS = ["GENERAL","OBC","SC","ST","EWS"];

const phone = (n) => `98${String(10000000 + n * 1237).padStart(8, "0")}`;
const person = (i) => `${FIRST[i % 20]} ${LAST[Math.floor(i / 5) % 12]}`;

async function reset() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "MarkAudit"'); // append-only table: reset by TRUNCATE
  for (const m of ["alertLog", "mentorTask", "riskFlag", "paymentLink", "feeLedgerEntry", "feeStructure", "markEntry", "markComponent",
    "attendanceRecord", "attendanceSession", "courseAllocation", "student", "subject", "batch", "programme", "user", "campus"]) {
    await prisma[m].deleteMany();
  }
}

async function main() {
  await reset();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const campus = await prisma.campus.create({ data: { name: "Sutra Engineering College (Demo)", code: "ENG" } });
  const campusId = campus.id;

  const admin = await prisma.user.create({ data: { campusId, name: "Lipika Rath", email: "admin@sutra.demo", passwordHash, role: "ADMIN" } });

  const fac = {};
  for (const [name, email] of [
    ["Dr. Sanjay Behera", "sanjay@sutra.demo"],
    ["Prof. Meera Sahoo", "meera@sutra.demo"],
    ["Prof. Rakesh Jena", "rakesh@sutra.demo"],
    ["Prof. Anita Das", "anita@sutra.demo"],
    ["Prof. Biswajit Sethy", "biswajit@sutra.demo"],
  ]) {
    fac[email] = await prisma.user.create({ data: { campusId, name, email, passwordHash, role: "FACULTY" } });
  }

  const cse = await prisma.programme.create({ data: { campusId, code: "CSE", name: "B.Tech Computer Science & Engineering", years: 4 } });
  const me = await prisma.programme.create({ data: { campusId, code: "ME", name: "B.Tech Mechanical Engineering", years: 4 } });
  const cseBatch = await prisma.batch.create({ data: { programmeId: cse.id, startYear: 2024, label: "2024–28" } });
  const meBatch = await prisma.batch.create({ data: { programmeId: me.id, startYear: 2024, label: "2024–28" } });

  const mk = (programmeId, code, name, semester) => prisma.subject.create({ data: { programmeId, code, name, semester } });
  const ds = await mk(cse.id, "CS301", "Data Structures", 3);
  const db = await mk(cse.id, "CS302", "Database Management Systems", 3);
  const os = await mk(cse.id, "CS303", "Operating Systems", 3);
  const dm = await mk(cse.id, "MA301", "Discrete Mathematics", 3);
  const th = await mk(me.id, "ME301", "Thermodynamics", 3);

  const alloc = (subjectId, batchId, f) => prisma.courseAllocation.create({ data: { subjectId, batchId, facultyId: fac[f].id } });
  await alloc(ds.id, cseBatch.id, "sanjay@sutra.demo");
  await alloc(db.id, cseBatch.id, "meera@sutra.demo");
  await alloc(os.id, cseBatch.id, "rakesh@sutra.demo");
  await alloc(dm.id, cseBatch.id, "anita@sutra.demo");
  await alloc(th.id, meBatch.id, "biswajit@sutra.demo");

  // 60 CSE students: ENG-24-CSE-0401..0460. 0412 is the brief's sample student.
  const students = [];
  for (let i = 1; i <= 60; i++) {
    const rollNo = `ENG-24-CSE-${String(400 + i).padStart(4, "0")}`;
    students.push({
      campusId, batchId: cseBatch.id, rollNo,
      name: i === 12 ? "Subhashree Mohanty" : person(i),
      category: CATS[i % 5],
      guardianPhone: phone(i),
      isMinor: i <= 4,
      guardianConsent: i <= 3,
    });
  }

  // 12 ME students: ENG-24-ME-0171..0182. 0177 is the brief's Ankit Panda.
  for (let i = 1; i <= 12; i++) {
    students.push({
      campusId, batchId: meBatch.id,
      rollNo: `ENG-24-ME-${String(170 + i).padStart(4, "0")}`,
      name: i === 7 ? "Ankit Panda" : person(i + 30),
      category: CATS[(i + 2) % 5],
      guardianPhone: phone(100 + i),
    });
  }

  await prisma.student.createMany({ data: students });

  // Seed attendance history and generate shortage alerts.
  await seedAttendance(prisma);
  await seedMarks(prisma, admin.id);
  await seedFees(prisma);
  console.log("Risk scan:", await runRiskScan(campusId, { db: prisma }));
  console.log("Fee reminders:", await runFeeReminders(campusId, { db: prisma }));

  const alerts = await runShortageAlerts(campusId, { db: prisma });
  console.log(`Shortage alert log rows: ${alerts.created}`);

  console.log(`Seeded: 1 campus, 6 users, 2 programmes, ${students.length} students.`);
  console.log(`Demo logins (password "${PASSWORD}"): admin@sutra.demo, sanjay@sutra.demo`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());