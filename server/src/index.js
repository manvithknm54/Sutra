import "dotenv/config";
import cron from "node-cron";
import { app } from "./app.js";
import { prisma } from "./db.js";
import { runShortageAlerts } from "./lib/alerts.js";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be set and at least 32 characters.");
  process.exit(1);
}

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Sutra API on :${port}`));

// Daily shortage sweep, 6:30 pm IST, Mon to Sat. It also runs after every sync that changes attendance.
cron.schedule("30 18 * * 1-6", async () => {
  const campuses = await prisma.campus.findMany({ select: { id: true } });
  for (const c of campuses) await runShortageAlerts(c.id).catch(console.error);
}, { timezone: "Asia/Kolkata" });