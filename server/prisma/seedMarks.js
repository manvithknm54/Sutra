import { effectiveDelta } from "../src/lib/marks.js";

const SPEC = [["Test 1", 10], ["Test 2", 10], ["Assignment", 10], ["Lab", 10]]; // assumption: 4 components x 10 = 40
const STATE = { CS301: "DRAFT", CS302: "SUBMITTED", CS303: "MODERATED", MA301: "LOCKED", ME301: "DRAFT" };
// The brief's sample students: Subhashree 33/40 and Ankit 21/40.
const FIXED = { "ENG-24-CSE-0412:CS301": [8.5, 8, 9, 7.5], "ENG-24-ME-0177:ME301": [5, 5, 6, 5] };
// CS301 is a Draft with four Lab marks still missing, so Submit is blocked until the teacher fills them.
const MISSING_LAB = new Set(["ENG-24-CSE-0405", "ENG-24-CSE-0418", "ENG-24-CSE-0430", "ENG-24-CSE-0445"]);

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 11);
const half = (x) => Math.round(x * 2) / 2;
const at = (iso) => new Date(iso);

export async function seedMarks(prisma, adminId) {
  const allocs = await prisma.courseAllocation.findMany({ include: { subject: true } });

  for (const a of allocs) {
    const code = a.subject.code;
    const state = STATE[code] ?? "DRAFT";
    const comps = [];
    for (const [i, [name, maxMarks]] of SPEC.entries())
      comps.push(await prisma.markComponent.create({ data: { allocationId: a.id, name, maxMarks, position: i } }));
    const students = await prisma.student.findMany({ where: { batchId: a.batchId }, orderBy: { rollNo: "asc" } });

    const mod = code === "CS303" ? { comp: "Test 2", d: 1.5, why: "Test 2 paper ran long; normalised for the whole batch" }
      : code === "MA301" ? { comp: "Assignment", d: 1, why: "Assignment rubric was revised after evaluation" } : null;
    const moderated = state === "MODERATED" || state === "LOCKED";

    const entries = [], audits = [];
    for (const s of students) {
      const rng = mulberry32(hash(s.rollNo + code));
      const ability = 0.45 + rng() * 0.5;
      const fixed = FIXED[`${s.rollNo}:${code}`];
      comps.forEach((c, i) => {
        if (code === "CS301" && c.name === "Lab" && MISSING_LAB.has(s.rollNo)) return;
        const raw = fixed ? fixed[i] : half(c.maxMarks * Math.min(1, Math.max(0.2, ability + (rng() - 0.5) * 0.25)));
        const eff = mod && moderated && mod.comp === c.name ? effectiveDelta(raw, mod.d, c.maxMarks) : 0;
        entries.push({ componentId: c.id, studentId: s.id, rawMarks: raw, moderationDelta: eff, moderationReason: eff ? mod.why : null });
        if (eff) audits.push({
          allocationId: a.id, studentId: s.id, component: c.name, actorId: adminId, action: "MODERATE",
          oldValue: "0", newValue: String(eff), reason: mod.why, at: at("2026-10-30T11:30:00+05:30"),
        });
      });
    }
    await prisma.markEntry.createMany({ data: entries });

    const log = (action, actorId, from, to, when, reason = null) =>
      audits.push({ allocationId: a.id, actorId, action, oldValue: from, newValue: to, reason, at: at(when) });
    if (state !== "DRAFT") log("SUBMIT", a.facultyId, "DRAFT", "SUBMITTED", "2026-10-29T16:00:00+05:30");
    if (moderated) log("COMPLETE_MODERATION", adminId, "SUBMITTED", "MODERATED", "2026-10-30T12:00:00+05:30");
    if (state === "LOCKED") {
      log("LOCK", adminId, "MODERATED", "LOCKED", "2026-10-31T10:00:00+05:30");
      log("UNLOCK_REQUEST", a.facultyId, "LOCKED", "LOCKED", "2026-11-02T15:20:00+05:30",
        "Two Assignment marks were entered against the wrong roll numbers.");
    }
    await prisma.markAudit.createMany({ data: audits });
    await prisma.courseAllocation.update({
      where: { id: a.id },
      data: { marksStatus: state, lockedAt: state === "LOCKED" ? at("2026-10-31T10:00:00+05:30") : null },
    });
  }
  console.log("Marks seeded: CS301 Draft, CS302 Submitted, CS303 Moderated, MA301 Locked (unlock requested), ME301 Draft.");
}