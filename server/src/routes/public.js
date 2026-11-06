import { Router } from "express";
import rateLimit from "express-rate-limit";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { HttpError } from "../lib/http.js";
import { dueOf, inr } from "../lib/fees.js";
import { ledgerTotals, nextReceiptNo } from "../lib/feeData.js";
import { publish } from "../lib/events.js";

const router = Router();
router.use(rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: "Too many requests. Try again in a minute." } }));

const loadLink = (token) =>
  prisma.paymentLink.findUnique({
    where: { token },
    include: { student: { select: { id: true, name: true, rollNo: true, campusId: true, batch: { select: { label: true, programme: { select: { code: true } } } } } } },
  });

const receiptOf = async (linkId) =>
  (await prisma.feeLedgerEntry.findUnique({ where: { idempotencyKey: `link:${linkId}` }, select: { receiptNo: true } }))?.receiptNo ?? null;

router.get("/pay/:token", async (req, res) => {
  const link = await loadLink(req.params.token);
  if (!link) return res.status(404).json({ error: "This payment link isn't valid" });
  const expired = link.status === "OPEN" && link.expiresAt < new Date();
  res.json({
    student: { name: link.student.name, rollNo: link.student.rollNo, programme: link.student.batch.programme.code, batch: link.student.batch.label },
    amountPaise: link.amountPaise, status: expired ? "EXPIRED" : link.status, expiresAt: link.expiresAt,
    receiptNo: link.status === "PAID" ? await receiptOf(link.id) : null,
  });
});

// Test mode: no real money moves. Paying twice returns the same receipt (idempotent).
router.post("/pay/:token", async (req, res) => {
  const link = await loadLink(req.params.token);
  if (!link) return res.status(404).json({ error: "This payment link isn't valid" });
  if (link.status === "PAID") return res.json({ status: "PAID", receiptNo: await receiptOf(link.id) });
  if (link.status !== "OPEN") return res.status(409).json({ error: "This link is no longer active. Please ask the office for a new one." });
  if (link.expiresAt < new Date()) return res.status(409).json({ error: "This link has expired. Please ask the office for a new one." });

  try {
    const receiptNo = await prisma.$transaction(async (tx) => {
      const fresh = await tx.paymentLink.findUnique({ where: { id: link.id } });
      if (fresh.status !== "OPEN") throw new HttpError(409, "This link is no longer active.");
      const due = dueOf((await ledgerTotals(tx, { studentId: link.studentId })).get(link.studentId));
      if (link.amountPaise > due) throw new HttpError(409, `The amount due changed to ${inr(Math.max(due, 0))}. Please ask the office for a new link.`);
      const no = await nextReceiptNo(tx);
      await tx.feeLedgerEntry.create({
        data: { studentId: link.studentId, type: "PAYMENT", amountPaise: link.amountPaise, method: "UPI", reference: "Payment link",
          idempotencyKey: `link:${link.id}`, receiptNo: no, note: "Paid via payment link" },
      });
      await tx.paymentLink.update({ where: { id: link.id }, data: { status: "PAID", paidAt: new Date() } });
      return no;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
    publish(link.student.campusId, ["fees"]); // the office sees it instantly
    res.json({ status: "PAID", receiptNo });
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    if (e?.code === "P2002") return res.json({ status: "PAID", receiptNo: await receiptOf(link.id) });
    if (e?.code === "P2034") return res.status(409).json({ error: "Please try again." });
    throw e;
  }
});

export default router;