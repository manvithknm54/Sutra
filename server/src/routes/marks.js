import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireRole } from "../middleware/auth.js";
import { ACTIONS, can, csvCell, deriveUnlock, effectiveDelta, parseMark, transition } from "../lib/marks.js";

const router = Router();
const UNLOCK_ACTIONS = ["LOCK", "UNLOCK_REQUEST", "UNLOCK_APPROVE", "UNLOCK_REJECT"];
const ORDER_ASC = [{ at: "asc" }, { id: "asc" }];

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (res, e) => { if (e instanceof HttpError) return res.status(e.status).json({ error: e.message }); throw e; };

// Campus-scoped. Faculty can only reach their own allocations.
const loadAlloc = (user, id) =>
  prisma.courseAllocation.findFirst({
    where: { id, subject: { programme: { campusId: user.campusId } }, ...(user.role === "FACULTY" ? { facultyId: user.id } : {}) },
    include: {
      subject: { select: { code: true, name: true, semester: true } },
      batch: { select: { id: true, label: true, programme: { select: { code: true } } } },
      faculty: { select: { id: true, name: true } },
      components: { orderBy: [{ position: "asc" }, { id: "asc" }] },
    },
  });

const rosterOf = (a, campusId) =>
  prisma.student.findMany({ where: { batchId: a.batch.id, campusId }, orderBy: { rollNo: "asc" }, select: { id: true, rollNo: true, name: true } });

// ---------- list ----------
router.get("/", async (req, res) => {
  const { user } = req;
  const allocs = await prisma.courseAllocation.findMany({
    where: { subject: { programme: { campusId: user.campusId } }, ...(user.role === "FACULTY" ? { facultyId: user.id } : {}) },
    orderBy: [{ batch: { startYear: "desc" } }, { subject: { code: "asc" } }],
    include: {
      subject: { select: { code: true, name: true, semester: true } },
      batch: { select: { label: true, programme: { select: { code: true } }, _count: { select: { students: true } } } },
      faculty: { select: { name: true } },
      components: { select: { id: true } },
    },
  });
  const owner = new Map();
  allocs.forEach((a) => a.components.forEach((c) => owner.set(c.id, a.id)));
  const counts = owner.size
    ? await prisma.markEntry.groupBy({ by: ["componentId"], where: { componentId: { in: [...owner.keys()] } }, _count: { _all: true } })
    : [];
  const filled = new Map();
  counts.forEach((c) => { const id = owner.get(c.componentId); filled.set(id, (filled.get(id) ?? 0) + c._count._all); });

  const audits = await prisma.markAudit.findMany({
    where: { allocationId: { in: allocs.map((a) => a.id) }, action: { in: UNLOCK_ACTIONS } }, orderBy: ORDER_ASC,
  });
  const byAlloc = new Map();
  audits.forEach((r) => byAlloc.set(r.allocationId, [...(byAlloc.get(r.allocationId) ?? []), r]));

  res.json({
    items: allocs.map((a) => ({
      id: a.id, subject: a.subject, faculty: a.faculty.name, status: a.marksStatus, lockedAt: a.lockedAt,
      batch: { label: a.batch.label, programme: a.batch.programme.code, students: a.batch._count.students },
      filled: filled.get(a.id) ?? 0, expected: a.batch._count.students * a.components.length,
      unlockRequested: deriveUnlock(byAlloc.get(a.id) ?? []).pending,
    })),
  });
});

// ---------- one sheet ----------
router.get("/:id", async (req, res) => {
  const { user } = req;
  const a = await loadAlloc(user, req.params.id);
  if (!a) return res.status(404).json({ error: "Mark sheet not found" });

  const [students, entries, audits] = await Promise.all([
    rosterOf(a, user.campusId),
    prisma.markEntry.findMany({
      where: { component: { allocationId: a.id } },
      select: { componentId: true, studentId: true, rawMarks: true, moderationDelta: true, moderationReason: true },
    }),
    prisma.markAudit.findMany({ where: { allocationId: a.id, action: { in: UNLOCK_ACTIONS } }, orderBy: ORDER_ASC }),
  ]);
  const cell = new Map(entries.map((e) => [`${e.studentId}:${e.componentId}`, e]));
  const maxTotal = a.components.reduce((n, c) => n + c.maxMarks, 0);

  const rows = students.map((s) => {
    let rawTotal = 0, delta = 0, finalTotal = 0, missing = 0;
    const marks = {};
    for (const c of a.components) {
      const e = cell.get(`${s.id}:${c.id}`);
      if (!e) { missing++; marks[c.id] = { raw: null, delta: 0 }; continue; }
      const raw = Number(e.rawMarks), d = Number(e.moderationDelta);
      rawTotal += raw; delta += d; finalTotal += raw + d;
      marks[c.id] = { raw, delta: d, reason: e.moderationReason };
    }
    return { studentId: s.id, rollNo: s.rollNo, name: s.name, marks, rawTotal, delta, finalTotal, missing };
  });

  const complete = rows.filter((r) => r.missing === 0);
  const top = complete.reduce((b, r) => (!b || r.finalTotal > b.finalTotal ? r : b), null);
  const moderated = rows.filter((r) => r.delta !== 0);
  const r1 = (n) => Math.round(n * 10) / 10;

  const ctx = { role: user.role, isOwner: a.facultyId === user.id, state: a.marksStatus };
  const unlock = deriveUnlock(audits);
  res.json({
    allocation: { id: a.id, subject: a.subject, batch: { label: a.batch.label, programme: a.batch.programme.code }, faculty: a.faculty.name },
    status: a.marksStatus, lockedAt: a.lockedAt, maxTotal,
    components: a.components.map((c) => ({ id: c.id, name: c.name, maxMarks: c.maxMarks })),
    rows,
    stats: {
      average: complete.length ? r1(complete.reduce((n, r) => n + r.finalTotal, 0) / complete.length) : null,
      top: top ? { name: top.name, total: top.finalTotal } : null,
      moderatedCount: moderated.length,
      avgDelta: moderated.length ? r1(moderated.reduce((n, r) => n + r.delta, 0) / moderated.length) : 0,
      filled: entries.length, expected: students.length * a.components.length,
    },
    unlock,
    perms: {
      canEdit: can({ ...ctx, action: "SUBMIT" }),
      canSubmit: can({ ...ctx, action: "SUBMIT" }),
      canReturn: can({ ...ctx, action: "RETURN" }),
      canModerate: user.role === "ADMIN" && ["SUBMITTED", "MODERATED"].includes(a.marksStatus),
      canCompleteModeration: can({ ...ctx, action: "COMPLETE_MODERATION" }),
      canLock: can({ ...ctx, action: "LOCK" }),
      canRequestUnlock: can({ ...ctx, action: "UNLOCK_REQUEST" }) && !unlock.pending,
      canResolveUnlock: can({ ...ctx, action: "UNLOCK_APPROVE" }) && unlock.pending,
      canExport: a.marksStatus === "LOCKED",
    },
  });
});

// ---------- faculty enters raw marks (DRAFT only). Every change is audited. ----------
const EntriesBody = z.object({
  entries: z.array(z.object({ studentId: z.string().min(1), componentId: z.string().min(1), marks: z.number().nullable() })).min(1).max(100),
});

router.put("/:id/entries", requireRole("FACULTY"), async (req, res) => {
  const p = EntriesBody.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid marks payload" });
  const { user } = req;
  const a = await loadAlloc(user, req.params.id);
  if (!a) return res.status(404).json({ error: "Mark sheet not found" });

  const comps = new Map(a.components.map((c) => [c.id, c]));
  const roster = new Set((await rosterOf(a, user.campusId)).map((s) => s.id));
  for (const e of p.data.entries) {
    const c = comps.get(e.componentId);
    if (!c || !roster.has(e.studentId)) return res.status(400).json({ error: "Unknown student or component" });
    try { parseMark(e.marks, c.maxMarks); } catch (err) { return res.status(400).json({ error: `${c.name}: ${err.message}` }); }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const cur = await tx.courseAllocation.findUnique({ where: { id: a.id }, select: { marksStatus: true } });
      if (cur.marksStatus !== "DRAFT") throw new HttpError(409, "Marks can't be edited at this stage");
      for (const e of p.data.entries) {
        const key = { componentId_studentId: { componentId: e.componentId, studentId: e.studentId } };
        const old = await tx.markEntry.findUnique({ where: key });
        const oldV = old ? Number(old.rawMarks) : null;
        if (oldV === e.marks) continue;
        let entryId = old?.id ?? null;
        if (e.marks === null) await tx.markEntry.delete({ where: key });
        else entryId = (await tx.markEntry.upsert({
          where: key, update: { rawMarks: e.marks }, create: { componentId: e.componentId, studentId: e.studentId, rawMarks: e.marks },
        })).id;
        await tx.markAudit.create({
          data: {
            allocationId: a.id, entryId, studentId: e.studentId, component: comps.get(e.componentId).name,
            actorId: user.id, action: "MARK_SET", oldValue: oldV == null ? null : String(oldV), newValue: e.marks == null ? null : String(e.marks),
          },
        });
      }
    }, { timeout: 15000 });
    res.json({ saved: p.data.entries.length });
  } catch (e) { return fail(res, e); }
});

// ---------- admin moderation: a recorded delta with a reason, never an overwrite ----------
const ModBody = z.object({
  componentId: z.string().min(1),
  studentId: z.string().min(1).nullable().optional(), // null or missing = whole class
  delta: z.number().min(-10).max(10),
  reason: z.string().trim().min(5).max(300),
});

router.post("/:id/moderate", requireRole("ADMIN"), async (req, res) => {
  const p = ModBody.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Check the adjustment and give a reason (5+ characters)" });
  const { componentId, studentId, delta, reason } = p.data;
  if (Math.round(delta * 2) !== delta * 2) return res.status(400).json({ error: "Use steps of 0.5" });
  const a = await loadAlloc(req.user, req.params.id);
  if (!a) return res.status(404).json({ error: "Mark sheet not found" });
  const comp = a.components.find((c) => c.id === componentId);
  if (!comp) return res.status(404).json({ error: "Component not found" });

  const entries = await prisma.markEntry.findMany({ where: { componentId, ...(studentId ? { studentId } : {}) } });
  if (!entries.length) return res.status(409).json({ error: "There are no marks to moderate" });

  let capped = 0, changed = 0;
  const updates = [], audits = [];
  for (const e of entries) {
    const raw = Number(e.rawMarks), old = Number(e.moderationDelta);
    const eff = effectiveDelta(raw, delta, comp.maxMarks);
    if (eff !== delta) capped++;
    if (eff === old) continue;
    changed++;
    updates.push({ id: e.id, eff });
    audits.push({
      allocationId: a.id, entryId: e.id, studentId: e.studentId, component: comp.name, actorId: req.user.id,
      action: "MODERATE", oldValue: String(old), newValue: String(eff), reason,
    });
  }
  try {
    await prisma.$transaction(async (tx) => {
      const cur = await tx.courseAllocation.findUnique({ where: { id: a.id }, select: { marksStatus: true } });
      if (!["SUBMITTED", "MODERATED"].includes(cur.marksStatus)) throw new HttpError(409, "Moderation isn't open for this sheet");
      for (const u of updates)
        await tx.markEntry.update({ where: { id: u.id }, data: { moderationDelta: u.eff, moderationReason: u.eff === 0 ? null : reason } });
      if (audits.length) await tx.markAudit.createMany({ data: audits });
    }, { timeout: 15000 });
    res.json({ changed, capped });
  } catch (e) { return fail(res, e); }
});

// ---------- workflow transitions (one endpoint, one rule table) ----------
const ActionBody = z.object({ action: z.enum(ACTIONS), reason: z.string().trim().max(300).optional() });

router.post("/:id/action", async (req, res) => {
  const p = ActionBody.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: "Invalid action" });
  const { action, reason } = p.data;
  const { user } = req;
  const a = await loadAlloc(user, req.params.id);
  if (!a) return res.status(404).json({ error: "Mark sheet not found" });

  const t = transition({ role: user.role, isOwner: a.facultyId === user.id, state: a.marksStatus, action, reason });
  if (!t.ok) return res.status(t.code).json({ error: t.error });

  if (action === "SUBMIT") {
    const [students, filled] = await Promise.all([
      prisma.student.count({ where: { batchId: a.batch.id, campusId: user.campusId } }),
      prisma.markEntry.count({ where: { component: { allocationId: a.id } } }),
    ]);
    const missing = students * a.components.length - filled;
    if (missing > 0) return res.status(409).json({ error: `${missing} mark${missing === 1 ? " is" : "s are"} still missing`, missing });
  }
  if (action.startsWith("UNLOCK")) {
    const audits = await prisma.markAudit.findMany({ where: { allocationId: a.id, action: { in: UNLOCK_ACTIONS } }, orderBy: ORDER_ASC });
    const pending = deriveUnlock(audits).pending;
    if (action === "UNLOCK_REQUEST" && pending) return res.status(409).json({ error: "An unlock request is already waiting" });
    if (action !== "UNLOCK_REQUEST" && !pending) return res.status(409).json({ error: "There is no unlock request to resolve" });
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (t.to !== a.marksStatus) {
        // Only succeeds if nobody changed the state since we read it (two admins clicking at once).
        const r = await tx.courseAllocation.updateMany({
          where: { id: a.id, marksStatus: a.marksStatus },
          data: { marksStatus: t.to, lockedAt: t.to === "LOCKED" ? new Date() : null },
        });
        if (r.count !== 1) throw new HttpError(409, "Someone else just changed this sheet. Refresh and try again.");
      }
      await tx.markAudit.create({
        data: { allocationId: a.id, actorId: user.id, action, oldValue: a.marksStatus, newValue: t.to, reason: reason || null },
      });
    });
    res.json({ status: t.to });
  } catch (e) { return fail(res, e); }
});

// ---------- audit trail ----------
router.get("/:id/audit", async (req, res) => {
  const a = await loadAlloc(req.user, req.params.id);
  if (!a) return res.status(404).json({ error: "Mark sheet not found" });
  const rows = await prisma.markAudit.findMany({ where: { allocationId: a.id }, orderBy: [{ at: "desc" }, { id: "desc" }], take: 1000 });

  // A moderation applied to a whole class is stored as one row per student. Show it as one entry.
  const merged = [];
  for (const r of rows) {
    const p = merged[merged.length - 1];
    if (r.action === "MODERATE" && p?.action === "MODERATE" && p.actorId === r.actorId && p.component === r.component &&
        p.reason === r.reason && p.oldValue === r.oldValue && p.newValue === r.newValue && Math.abs(p.at - r.at) < 60000) {
      p.count++;
      continue;
    }
    merged.push({ ...r, count: 1 });
  }

  const [actors, students] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: [...new Set(merged.map((r) => r.actorId))] } }, select: { id: true, name: true, role: true } }),
    prisma.student.findMany({ where: { id: { in: [...new Set(merged.map((r) => r.studentId).filter(Boolean))] } }, select: { id: true, name: true, rollNo: true } }),
  ]);
  const A = new Map(actors.map((x) => [x.id, x])), S = new Map(students.map((x) => [x.id, x]));
  res.json({
    items: merged.map((r) => ({
      id: r.id, at: r.at, action: r.action, component: r.component, oldValue: r.oldValue, newValue: r.newValue,
      reason: r.reason, count: r.count,
      actor: A.get(r.actorId) ?? { name: "Unknown", role: "" },
      student: r.count === 1 && r.studentId ? S.get(r.studentId) ?? null : null,
    })),
  });
});

// ---------- university upload export (only after lock; the export itself is logged) ----------
// Assumption: the brief doesn't give the university's template, so this is a generic upload CSV.
router.get("/:id/export.csv", async (req, res) => {
  const { user } = req;
  const a = await loadAlloc(user, req.params.id);
  if (!a) return res.status(404).json({ error: "Mark sheet not found" });
  if (a.marksStatus !== "LOCKED") return res.status(409).json({ error: "Export is available after the sheet is locked" });

  const [students, entries] = await Promise.all([
    rosterOf(a, user.campusId),
    prisma.markEntry.findMany({ where: { component: { allocationId: a.id } }, select: { studentId: true, rawMarks: true, moderationDelta: true } }),
  ]);
  const total = new Map();
  for (const e of entries) total.set(e.studentId, (total.get(e.studentId) ?? 0) + Number(e.rawMarks) + Number(e.moderationDelta));
  const max = a.components.reduce((n, c) => n + c.maxMarks, 0);

  const head = ["Roll No", "Student Name", "Subject Code", "Semester", `Internal Marks (of ${max})`];
  const lines = [head, ...students.map((s) => [s.rollNo, s.name, a.subject.code, a.subject.semester, (total.get(s.id) ?? 0).toFixed(1)])]
    .map((r) => r.map(csvCell).join(","));

  await prisma.markAudit.create({ data: { allocationId: a.id, actorId: user.id, action: "EXPORT", newValue: `${students.length} rows` } });
  const file = `INTERNALS_${a.subject.code}_${a.batch.label}`.replace(/[^A-Za-z0-9_.-]/g, "-") + ".csv";
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${file}"`);
  res.send("\ufeff" + lines.join("\r\n") + "\r\n"); // BOM so Excel reads it correctly
});

export default router;