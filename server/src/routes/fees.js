import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { csvCell } from "../lib/marks.js";
import { HttpError } from "../lib/http.js";
import { checkAmount, dueOf, feeLinkMessage, inr, studyYear, toPaise } from "../lib/fees.js";
import { feeRows, ledgerTotals, nextReceiptNo } from "../lib/feeData.js";

const router = Router();
const SERIALIZABLE = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 };
const iso = (d) => (d ? d.toISOString().slice(0, 10) : null);
const slim = (e) => ({ id: e.id, type: e.type, amountPaise: e.amountPaise, note: e.note, method: e.method,
  reference: e.reference, receiptNo: e.receiptNo, dueDate: iso(e.dueDate), at: e.at });
const dueNow = async (db, studentId) => dueOf((await ledgerTotals(db, { studentId })).get(studentId));
const findStudent = (req) =>
  prisma.student.findFirst({
    where: { id: req.params.id, campusId: req.user.campusId },
    select: { id: true, rollNo: true, name: true, category: true, guardianPhone: true, isMinor: true, guardianConsent: true,
      batch: { select: { label: true, programme: { select: { code: true } } } } },
  });
const amountMsg = (code, due) =>
  code === "TOO_MUCH" ? `That is more than the ${inr(due)} due` : code === "NO_DUE" ? "Nothing is due for this student" : "Enter a whole-rupee amount above zero";

// Returns true if it handled a transaction failure.
function txFail(res, e) {
  if (e instanceof HttpError) { res.status(e.status).json({ error: e.message }); return true; }
  if (e?.code === "P2034") { res.status(409).json({ error: "Another update was in progress. Please try again." }); return true; }
  return false;
}

// ---------- dues list and KPIs ----------
const DuesQuery = z.object({
  search: z.string().trim().max(60).optional(), programmeId: z.string().optional(),
  status: z.enum(["all", "due", "critical", "cleared"]).default("all"),
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

router.get("/dues", async (req, res) => {
  const q = DuesQuery.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "Invalid filters" });
  const { search, programmeId, status, page, pageSize } = q.data;
  const all = await feeRows(prisma, req.user.campusId);

  const owing = all.filter((r) => r.due > 0), crit = all.filter((r) => r.status === "CRITICAL");
  const sum = (a, k) => a.reduce((n, r) => n + r[k], 0);
  const summary = {
    billed: sum(all, "billed"), scholarship: sum(all, "scholarship"), paid: sum(all, "paid"),
    outstanding: sum(owing, "due"), owingCount: owing.length, criticalAmount: sum(crit, "due"), criticalCount: crit.length,
  };

  const n = search?.toLowerCase();
  let rows = all.filter((r) =>
    (!programmeId || r.programmeId === programmeId) &&
    (!n || r.name.toLowerCase().includes(n) || r.rollNo.toLowerCase().includes(n)) &&
    (status === "all" || (status === "due" && r.due > 0) || (status === "critical" && r.status === "CRITICAL") || (status === "cleared" && r.due <= 0)));
  if (status === "due" || status === "critical") rows = rows.sort((a, b) => b.overdueDays - a.overdueDays || b.due - a.due);

  res.json({ summary, items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize });
});

router.get("/structures", async (req, res) => {
  const items = await prisma.feeStructure.findMany({
    where: { programme: { campusId: req.user.campusId } },
    orderBy: [{ programme: { code: "asc" } }, { yearNo: "asc" }, { category: "asc" }],
    select: { id: true, category: true, yearNo: true, amountPaise: true, programme: { select: { code: true, name: true } } },
  });
  res.json({ items });
});

// ---------- one student's ledger ----------
router.get("/student/:id", async (req, res) => {
  const st = await findStudent(req);
  if (!st) return res.status(404).json({ error: "Student not found" });
  const [entries, totals, link] = await Promise.all([
    prisma.feeLedgerEntry.findMany({ where: { studentId: st.id }, orderBy: [{ at: "desc" }, { id: "desc" }] }),
    ledgerTotals(prisma, { studentId: st.id }),
    prisma.paymentLink.findFirst({ where: { studentId: st.id, status: "OPEN", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
  ]);
  const t = totals.get(st.id) ?? {};
  res.json({
    student: { id: st.id, rollNo: st.rollNo, name: st.name, category: st.category, programme: st.batch.programme.code, batch: st.batch.label,
      guardianPhone: st.guardianPhone ? `••••••${st.guardianPhone.slice(-4)}` : null, isMinor: st.isMinor, guardianConsent: st.guardianConsent },
    totals: { billed: t.charge ?? 0, scholarship: t.scholarship ?? 0, paid: t.payment ?? 0, due: dueOf(t) },
    entries: entries.map(slim),
    openLink: link ? { url: `${process.env.CLIENT_ORIGIN ?? ""}/pay/${link.token}`, amountPaise: link.amountPaise, expiresAt: link.expiresAt } : null,
  });
});

// ---------- record a payment (counter, UPI, card, bank). Safe to double-click. ----------
const PayBody = z.object({
  amountRupees: z.number().int().min(1).max(10_000_000),
  method: z.enum(["COUNTER", "UPI", "CARD", "BANK"]),
  reference: z.string().trim().max(60).optional(),
  key: z.string().uuid(), // generated when the dialog opens, so a repeat click is the same payment
});

router.post("/student/:id/payments", async (req, res) => {
  const p = PayBody.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Check the amount, method and reference" });
  const st = await findStudent(req);
  if (!st) return res.status(404).json({ error: "Student not found" });
  const key = `pay:${st.id}:${p.data.key}`;
  const dup = await prisma.feeLedgerEntry.findUnique({ where: { idempotencyKey: key } });
  if (dup) return res.json({ entry: slim(dup), duplicate: true });

  const paise = toPaise(p.data.amountRupees);
  try {
    const entry = await prisma.$transaction(async (tx) => {
      const due = await dueNow(tx, st.id);
      const bad = checkAmount(paise, due);
      if (bad) throw new HttpError(409, amountMsg(bad, due));
      return tx.feeLedgerEntry.create({
        data: { studentId: st.id, type: "PAYMENT", amountPaise: paise, method: p.data.method, reference: p.data.reference || null,
          idempotencyKey: key, receiptNo: await nextReceiptNo(tx), note: "Payment received", actorId: req.user.id },
      });
    }, SERIALIZABLE);
    res.status(201).json({ entry: slim(entry) });
  } catch (e) {
    if (e?.code === "P2002") {
      const d = await prisma.feeLedgerEntry.findUnique({ where: { idempotencyKey: key } });
      if (d) return res.json({ entry: slim(d), duplicate: true });
    }
    if (!txFail(res, e)) throw e;
  }
});

// ---------- scholarship (reduces dues, needs a reason) ----------
const SchBody = z.object({ amountRupees: z.number().int().min(1).max(10_000_000), reason: z.string().trim().min(5).max(200), key: z.string().uuid() });

router.post("/student/:id/scholarships", async (req, res) => {
  const p = SchBody.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Enter an amount and a reason (5+ characters)" });
  const st = await findStudent(req);
  if (!st) return res.status(404).json({ error: "Student not found" });
  const key = `sch:${st.id}:${p.data.key}`;
  const dup = await prisma.feeLedgerEntry.findUnique({ where: { idempotencyKey: key } });
  if (dup) return res.json({ entry: slim(dup), duplicate: true });
  const paise = toPaise(p.data.amountRupees);
  try {
    const entry = await prisma.$transaction(async (tx) => {
      const due = await dueNow(tx, st.id);
      const bad = checkAmount(paise, due);
      if (bad) throw new HttpError(409, amountMsg(bad, due));
      return tx.feeLedgerEntry.create({
        data: { studentId: st.id, type: "SCHOLARSHIP", amountPaise: paise, idempotencyKey: key, note: p.data.reason, actorId: req.user.id },
      });
    }, SERIALIZABLE);
    res.status(201).json({ entry: slim(entry) });
  } catch (e) {
    if (e?.code === "P2002") {
      const d = await prisma.feeLedgerEntry.findUnique({ where: { idempotencyKey: key } });
      if (d) return res.json({ entry: slim(d), duplicate: true });
    }
    if (!txFail(res, e)) throw e;
  }
});

// ---------- payment link (test mode). Creating a new one cancels the old one. ----------
router.post("/student/:id/links", async (req, res) => {
  const p = z.object({ amountRupees: z.number().int().min(1).max(10_000_000).optional() }).safeParse(req.body ?? {});
  if (!p.success) return res.status(400).json({ error: "Invalid amount" });
  const st = await findStudent(req);
  if (!st) return res.status(404).json({ error: "Student not found" });
  const due = await dueNow(prisma, st.id);
  const paise = p.data.amountRupees ? toPaise(p.data.amountRupees) : due;
  const bad = checkAmount(paise, due);
  if (bad) return res.status(409).json({ error: amountMsg(bad, due) });

  const token = crypto.randomBytes(24).toString("base64url");
  const link = await prisma.$transaction(async (tx) => {
    await tx.paymentLink.updateMany({ where: { studentId: st.id, status: "OPEN" }, data: { status: "CANCELLED" } });
    return tx.paymentLink.create({
      data: { studentId: st.id, token, amountPaise: paise, expiresAt: new Date(Date.now() + 7 * 864e5), createdById: req.user.id },
    });
  });
  const url = `${process.env.CLIENT_ORIGIN ?? ""}/pay/${token}`;
  res.status(201).json({ link: { url, amountPaise: paise, expiresAt: link.expiresAt }, message: feeLinkMessage(st.name, paise, url) });
});

// ---------- generate dues for a batch. Safe to run twice: the second run changes nothing. ----------
const GenBody = z.object({
  batchId: z.string().min(1), term: z.string().regex(/^\d{4}-\d{2}$/), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

router.post("/generate", async (req, res) => {
  const p = GenBody.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Choose a batch, a term like 2026-27 and a due date" });
  const { batchId, term, dueDate } = p.data;
  const campusId = req.user.campusId;
  const batch = await prisma.batch.findFirst({ where: { id: batchId, programme: { campusId } }, include: { programme: true } });
  if (!batch) return res.status(404).json({ error: "Batch not found" });
  const year = studyYear(batch.startYear, term);
  if (year < 1 || year > batch.programme.years) return res.status(400).json({ error: "That batch isn't in a study year for that term" });

  const [structs, students] = await Promise.all([
    prisma.feeStructure.findMany({ where: { programmeId: batch.programmeId, yearNo: year } }),
    prisma.student.findMany({ where: { batchId, campusId }, select: { id: true, category: true } }),
  ]);
  const amt = new Map(structs.map((s) => [s.category, s.amountPaise]));
  const data = [];
  let missing = 0;
  for (const s of students) {
    if (!amt.has(s.category)) { missing++; continue; }
    data.push({ studentId: s.id, type: "CHARGE", amountPaise: amt.get(s.category), note: `Tuition fee ${term}`,
      idempotencyKey: `charge:${s.id}:${term}`, dueDate: new Date(`${dueDate}T00:00:00Z`), actorId: req.user.id });
  }
  const r = await prisma.feeLedgerEntry.createMany({ data, skipDuplicates: true });
  res.json({ created: r.count, skipped: data.length - r.count, missing, year });
});

// ---------- printable receipt ----------
router.get("/receipt/:id", async (req, res) => {
  const e = await prisma.feeLedgerEntry.findFirst({
    where: { id: req.params.id, type: "PAYMENT", student: { campusId: req.user.campusId } },
    include: { student: { select: { id: true, name: true, rollNo: true, batch: { select: { label: true, programme: { select: { name: true } } } } } } },
  });
  if (!e) return res.status(404).json({ error: "Receipt not found" });
  const campus = await prisma.campus.findUnique({ where: { id: req.user.campusId }, select: { name: true } });
  res.json({
    receiptNo: e.receiptNo, at: e.at, amountPaise: e.amountPaise, method: e.method, reference: e.reference,
    student: { name: e.student.name, rollNo: e.student.rollNo, programme: e.student.batch.programme.name, batch: e.student.batch.label },
    campus: campus.name, dueAfter: await dueNow(prisma, e.student.id),
  });
});

// ---------- accounts export ----------
// Assumption: the brief doesn't specify Tally's format, so this is a receipt-voucher CSV the accountant can import. Tally XML is cut.
router.get("/export/tally.csv", async (req, res) => {
  const m = /^\d{4}-\d{2}$/.test(String(req.query.month ?? "")) ? String(req.query.month) : null;
  let range = {};
  if (m) {
    const [y, mo] = m.split("-").map(Number);
    range = { at: { gte: new Date(Date.UTC(y, mo - 1, 1) - 330 * 60000), lt: new Date(Date.UTC(y, mo, 1) - 330 * 60000) } };
  }
  const rows = await prisma.feeLedgerEntry.findMany({
    where: { type: "PAYMENT", student: { campusId: req.user.campusId }, ...range },
    orderBy: [{ at: "asc" }, { id: "asc" }],
    include: { student: { select: { name: true, rollNo: true } } },
  });
  const ddmmyyyy = (d) => { const [Y, M, D] = new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 10).split("-"); return `${D}-${M}-${Y}`; };
  const head = ["Date", "Voucher Type", "Voucher No", "Party Ledger", "Amount (INR)", "Deposit Ledger", "Narration", "Reference"];
  const lines = [head, ...rows.map((r) => [ddmmyyyy(r.at), "Receipt", r.receiptNo, `${r.student.rollNo} ${r.student.name}`,
    (r.amountPaise / 100).toFixed(2), r.method === "COUNTER" ? "Cash" : "Bank", `Fee received (${r.method})`, r.reference ?? ""])]
    .map((r) => r.map(csvCell).join(","));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="fee-receipts${m ? `-${m}` : ""}.csv"`);
  res.send("\ufeff" + lines.join("\r\n") + "\r\n");
});

export default router;