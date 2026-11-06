import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireRole } from "../middleware/auth.js";
import { getLastScan, levelOf, runRiskScan } from "../lib/risk.js";

const router = Router();

const Q = z.object({ status: z.enum(["OPEN", "DISMISSED", "ACTIONED", "all"]).default("OPEN") });

router.get("/", async (req, res) => {
  const q = Q.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "Invalid filter" });
  const { user } = req;
  const admin = user.role === "ADMIN";
  const scope = { student: { campusId: user.campusId }, ...(admin ? {} : { task: { mentorId: user.id } }) };

  const flags = await prisma.riskFlag.findMany({
    where: { ...scope, ...(q.data.status === "all" ? {} : { status: q.data.status }) },
    orderBy: [{ score: "desc" }, { createdAt: "asc" }],
    include: { student: { select: { id: true, name: true, rollNo: true, batch: { select: { label: true, programme: { select: { code: true } } } } } },
      task: { include: { mentor: { select: { id: true, name: true } } } } },
  });
  const all = await prisma.riskFlag.findMany({ where: scope, select: { status: true, score: true } });
  const open = all.filter((f) => f.status === "OPEN");
  res.json({
    items: flags.map((f) => ({
      id: f.id, score: f.score, level: levelOf(f.score), status: f.status, reasons: f.reasons, dismissReason: f.dismissReason,
      createdAt: f.createdAt, updatedAt: f.updatedAt, student: f.student,
      mentor: f.task?.mentor ?? null, taskDone: f.task?.done ?? false, taskNote: f.task?.note ?? null,
      canAct: f.status === "OPEN" && (admin || f.task?.mentorId === user.id),
    })),
    counts: { open: open.length, high: open.filter((f) => levelOf(f.score) === "HIGH").length,
      medium: open.filter((f) => levelOf(f.score) === "MEDIUM").length, closed: all.length - open.length },
    lastScan: getLastScan(user.campusId),
  });
});

router.post("/scan", requireRole("ADMIN"), async (req, res) => {
  const out = await runRiskScan(req.user.campusId);
  res.json(out);
});

async function loadFlag(req) {
  const f = await prisma.riskFlag.findFirst({ where: { id: req.params.id, student: { campusId: req.user.campusId } }, include: { task: true } });
  if (!f) return { error: [404, "Flag not found"] };
  if (req.user.role !== "ADMIN" && f.task?.mentorId !== req.user.id) return { error: [403, "This isn't your mentee"] };
  if (f.status !== "OPEN") return { error: [409, "This flag is already closed"] };
  return { f };
}

// Dismissing needs a reason and is kept as the record of the decision.
router.post("/:id/dismiss", async (req, res) => {
  const p = z.object({ reason: z.string().trim().min(5).max(300) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Please give a reason (5+ characters)" });
  const { f, error } = await loadFlag(req);
  if (error) return res.status(error[0]).json({ error: error[1] });
  await prisma.riskFlag.update({ where: { id: f.id }, data: { status: "DISMISSED", dismissReason: p.data.reason, dismissedById: req.user.id } });
  res.json({ ok: true });
});

router.post("/:id/done", async (req, res) => {
  const p = z.object({ note: z.string().trim().max(300).optional() }).safeParse(req.body ?? {});
  if (!p.success) return res.status(400).json({ error: "Invalid note" });
  const { f, error } = await loadFlag(req);
  if (error) return res.status(error[0]).json({ error: error[1] });
  await prisma.$transaction([
    prisma.riskFlag.update({ where: { id: f.id }, data: { status: "ACTIONED" } }),
    prisma.mentorTask.update({ where: { flagId: f.id }, data: { done: true, doneAt: new Date(), note: p.data.note || null } }),
  ]);
  res.json({ ok: true });
});

export default router;