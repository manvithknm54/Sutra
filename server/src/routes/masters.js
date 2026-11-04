import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireRole } from "../middleware/auth.js";

const router = Router();
const isUnique = (e) => e?.code === "P2002";
const bad = (res, msg = "Please check the details and try again") => res.status(400).json({ error: msg });

router.get("/summary", requireRole("ADMIN"), async (req, res) => {
  const c = req.user.campusId;
  const [students, programmes, faculty, subjects, allocations] = await Promise.all([
    prisma.student.count({ where: { campusId: c } }),
    prisma.programme.count({ where: { campusId: c } }),
    prisma.user.count({ where: { campusId: c, role: "FACULTY" } }),
    prisma.subject.count({ where: { programme: { campusId: c } } }),
    prisma.courseAllocation.count({ where: { subject: { programme: { campusId: c } } } }),
  ]);
  res.json({ students, programmes, faculty, subjects, allocations });
});

router.get("/programmes", requireRole("ADMIN"), async (req, res) => {
  const items = await prisma.programme.findMany({
    where: { campusId: req.user.campusId },
    orderBy: { code: "asc" },
    include: {
      _count: { select: { subjects: true } },
      batches: { orderBy: { startYear: "desc" }, include: { _count: { select: { students: true } } } },
    },
  });
  res.json({ items });
});

router.get("/subjects", requireRole("ADMIN"), async (req, res) => {
  const items = await prisma.subject.findMany({
    where: { programme: { campusId: req.user.campusId } },
    orderBy: [{ programme: { code: "asc" } }, { code: "asc" }],
    include: { programme: { select: { code: true } } },
  });
  res.json({ items });
});

const SubjectBody = z.object({
  programmeId: z.string().min(1),
  code: z.string().trim().min(2).max(16).toUpperCase(),
  name: z.string().trim().min(2).max(80),
  semester: z.coerce.number().int().min(1).max(12),
});

router.post("/subjects", requireRole("ADMIN"), async (req, res) => {
  const p = SubjectBody.safeParse(req.body);
  if (!p.success) return bad(res, "Check the subject code, name and semester");
  const programme = await prisma.programme.findFirst({
    where: { id: p.data.programmeId, campusId: req.user.campusId },
  });
  if (!programme) return res.status(404).json({ error: "Programme not found" });
  try {
    const item = await prisma.subject.create({ data: p.data });
    res.status(201).json({ item });
  } catch (e) {
    if (isUnique(e)) return res.status(409).json({ error: "That subject code already exists in this programme" });
    throw e;
  }
});

router.get("/faculty", requireRole("ADMIN"), async (req, res) => {
  const items = await prisma.user.findMany({
    where: { campusId: req.user.campusId, role: "FACULTY" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, _count: { select: { allocations: true } } },
  });
  res.json({ items });
});

// Admin sees every allocation on the campus. Faculty see only their own.
router.get("/allocations", async (req, res) => {
  const where = { subject: { programme: { campusId: req.user.campusId } } };
  if (req.user.role !== "ADMIN") where.facultyId = req.user.id;
  const items = await prisma.courseAllocation.findMany({
    where,
    orderBy: [{ batch: { startYear: "desc" } }, { subject: { code: "asc" } }],
    include: {
      subject: { select: { code: true, name: true, semester: true } },
      faculty: { select: { id: true, name: true } },
      batch: { select: { label: true, programme: { select: { code: true } }, _count: { select: { students: true } } } },
    },
  });
  res.json({ items });
});

const AllocBody = z.object({
  subjectId: z.string().min(1),
  batchId: z.string().min(1),
  facultyId: z.string().min(1),
});

router.post("/allocations", requireRole("ADMIN"), async (req, res) => {
  const p = AllocBody.safeParse(req.body);
  if (!p.success) return bad(res);
  const campusId = req.user.campusId;
  const [subject, batch, faculty] = await Promise.all([
    prisma.subject.findFirst({ where: { id: p.data.subjectId, programme: { campusId } } }),
    prisma.batch.findFirst({ where: { id: p.data.batchId, programme: { campusId } } }),
    prisma.user.findFirst({ where: { id: p.data.facultyId, campusId, role: "FACULTY" } }),
  ]);
  if (!subject || !batch || !faculty) return res.status(404).json({ error: "Subject, batch or faculty not found" });
  if (subject.programmeId !== batch.programmeId) return bad(res, "That batch belongs to a different programme");
  try {
    const item = await prisma.courseAllocation.create({ data: p.data });
    res.status(201).json({ item });
  } catch (e) {
    if (isUnique(e)) return res.status(409).json({ error: "This subject is already allocated to that batch" });
    throw e;
  }
});

export default router;