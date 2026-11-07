import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireRole } from "../middleware/auth.js";
import { runFeeReminders, runShortageAlerts } from "../lib/alerts.js";

const router = Router();

const Query = z.object({
  search: z.string().trim().max(60).optional(),
  batchId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const maskPhone = (p) => (p ? `••••••${p.slice(-4)}` : null);

// Admin: whole campus. Faculty: only batches they are allocated to.
async function scopeFor(user) {
  if (user.role === "ADMIN") return { campusId: user.campusId };
  const mine = await prisma.courseAllocation.findMany({
    where: { facultyId: user.id },
    select: { batchId: true },
  });
  return { campusId: user.campusId, batchId: { in: [...new Set(mine.map((a) => a.batchId))] } };
}

router.get("/", async (req, res) => {
  const q = Query.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "Invalid filters" });
  const { search, batchId, page, pageSize } = q.data;

  const scope = await scopeFor(req.user);
  const where = { ...scope };
  if (batchId) {
    if (scope.batchId && !scope.batchId.in.includes(batchId)) {
      return res.json({ items: [], total: 0, page, pageSize });
    }
    where.batchId = batchId;
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { rollNo: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: { rollNo: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, rollNo: true, name: true, category: true,
        guardianPhone: true, isMinor: true, guardianConsent: true,
        batch: { select: { label: true, programme: { select: { code: true } } } },
      },
    }),
  ]);

  const items = rows.map(({ guardianPhone, ...s }) => ({ ...s, guardianPhone: maskPhone(guardianPhone) }));
  res.json({ items, total, page, pageSize });
});

const ConsentBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("give"), guardianName: z.string().trim().min(2).max(80),
    relation: z.enum(["Father", "Mother", "Legal guardian"]), note: z.string().trim().max(200).optional() }),
  z.object({ action: z.literal("withdraw"), note: z.string().trim().min(5).max(200) }),
]);

// DPDP: consent is recorded with who and when, and it can be withdrawn. Held messages go out once consent is given.
router.post("/:id/consent", requireRole("ADMIN"), async (req, res) => {
  const p = ConsentBody.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Check the guardian's name and relation" });
  const st = await prisma.student.findFirst({
    where: { id: req.params.id, campusId: req.user.campusId }, select: { id: true, isMinor: true, guardianConsent: true },
  });
  if (!st) return res.status(404).json({ error: "Student not found" });
  if (!st.isMinor) return res.status(409).json({ error: "Consent is only recorded for minors" });
  const give = p.data.action === "give";
  if (give === st.guardianConsent) return res.status(409).json({ error: give ? "Consent is already on file" : "There is no consent on file to withdraw" });

  await prisma.$transaction([
    prisma.student.update({ where: { id: st.id }, data: { guardianConsent: give } }),
    prisma.consentRecord.create({ data: {
      studentId: st.id, kind: give ? "GIVEN" : "WITHDRAWN", guardianName: give ? p.data.guardianName : null,
      relation: give ? p.data.relation : null, note: p.data.note || null, recordedById: req.user.id } }),
  ]);
  if (give) setImmediate(() => Promise.all([runShortageAlerts(req.user.campusId), runFeeReminders(req.user.campusId)]).catch(console.error));
  res.json({ ok: true, consent: give });
});

export default router;