import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../db.js";
import { SpecSchema, describeSpec, evaluate, ruleParse, specFromModel } from "../lib/assistant.js";
import { askModel, loadContext } from "../lib/assistantData.js";
import { todayIST } from "../lib/attendance.js";

const router = Router();
const limiter = rateLimit({
  windowMs: 60_000, limit: 20, keyGenerator: (req) => req.user.id, standardHeaders: true, legacyHeaders: false,
  message: { error: "Too many questions. Try again in a minute." },
});
const Body = z.object({ question: z.string().trim().min(3).max(300).optional(), spec: SpecSchema.optional() })
  .refine((b) => b.question || b.spec);
const HINT = 'Try: "How many third-year students are below 75% attendance this month?"';
const LIMIT = 500;

router.post("/ask", limiter, async (req, res) => {
  const b = Body.safeParse(req.body);
  if (!b.success) return res.status(400).json({ error: "Ask a question of 3 to 300 characters" });
  const campusId = req.user.campusId, today = todayIST();
  const programmes = await prisma.programme.findMany({ where: { campusId }, select: { code: true, name: true } });

  let spec = null, source = "replay";
  if (b.data.spec) spec = b.data.spec; // the "show these students" button replays the validated spec
  else {
    const raw = await askModel(b.data.question, programmes, today);
    if (raw) {
      if (raw.understood === false) return res.status(422).json({ error: raw.reason || "That isn't something I can answer from student records.", hint: HINT });
      spec = specFromModel(raw); source = "ai";
    }
    if (!spec) { spec = ruleParse(b.data.question, programmes); source = "rules"; }
    if (!spec) return res.status(422).json({ error: "I couldn't turn that into a query. I can only read student records, never change them.", hint: HINT });
  }
  if (spec.programme && !programmes.some((p) => p.code === spec.programme))
    return res.status(422).json({ error: `There is no programme "${spec.programme}" on this campus.`, hint: `Programmes: ${programmes.map((p) => p.code).join(", ")}` });

  const { rows, notEnough, years } = evaluate(spec, await loadContext(prisma, campusId, spec, today));
  const notes = [];
  if (notEnough) notes.push(`${notEnough} ${notEnough === 1 ? "student has" : "students have"} too few sessions in this period to judge, so they were left out.`);
  if (spec.studyYear && !years.includes(spec.studyYear)) notes.push(`No batch is in study year ${spec.studyYear} this term. Students on this campus are in year ${years.join(", ")}.`);
  if (spec.select === "list" && rows.length > LIMIT) notes.push(`Showing the first ${LIMIT} of ${rows.length}.`);

  res.json({
    source, spec, understood: describeSpec(spec), total: rows.length, notes,
    rows: spec.select === "count" ? [] : rows.slice(0, LIMIT),
  });
});

export default router;