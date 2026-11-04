import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

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

export default router;