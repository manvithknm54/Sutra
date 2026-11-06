import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

const router = Router();
const Q = z.object({
  group: z.enum(["all", "attendance", "fees"]).default("all"),
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

router.get("/", async (req, res) => {
  const q = Q.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "Invalid filters" });
  const { group, page, pageSize } = q.data;
  const where = { student: { campusId: req.user.campusId },
    ...(group === "attendance" ? { kind: { startsWith: "SHORTAGE" } } : group === "fees" ? { kind: { startsWith: "FEE" } } : {}) };
  const [total, rows] = await Promise.all([
    prisma.alertLog.count({ where }),
    prisma.alertLog.findMany({ where, orderBy: [{ at: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize,
      include: { student: { select: { name: true, rollNo: true } } } }),
  ]);
  res.json({ total, page, pageSize, items: rows.map((r) => ({
    id: r.id, kind: r.kind, held: r.kind.endsWith("_HELD"), weekKey: r.weekKey, channel: r.channel, at: r.at, body: r.body, student: r.student })) });
});

export default router;