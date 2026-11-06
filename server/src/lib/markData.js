import { prisma } from "../db.js";
import { DEFAULT_COMPONENTS } from "./marks.js";

// Safe to call any time: skipDuplicates plus the unique (allocationId, name) key mean it never creates twice.
export async function ensureComponents(allocationIds, db = prisma) {
  if (!allocationIds.length) return;
  await db.markComponent.createMany({
    data: allocationIds.flatMap((allocationId) =>
      DEFAULT_COMPONENTS.map(([name, maxMarks], position) => ({ allocationId, name, maxMarks, position }))),
    skipDuplicates: true,
  });
}

export async function ensureCampusComponents(campusId, db = prisma) {
  const empty = await db.courseAllocation.findMany({
    where: { subject: { programme: { campusId } }, components: { none: {} } }, select: { id: true },
  });
  await ensureComponents(empty.map((a) => a.id), db);
}