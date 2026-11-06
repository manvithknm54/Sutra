import "dotenv/config";
import cron from "node-cron";
import { app } from "./app.js";
import { prisma } from "./db.js";
import { runFeeReminders, runShortageAlerts } from "./lib/alerts.js";
import { runRiskScan } from "./lib/risk.js";
import { publish } from "./lib/events.js";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be set and at least 32 characters.");
  process.exit(1);
}

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Sutra API on :${port}`));

const eachCampus = async (fn) => {
  for (const c of await prisma.campus.findMany({ select: { id: true } })) await fn(c.id).catch(console.error);
};
const tz = { timezone: "Asia/Kolkata" };

cron.schedule("30 18 * * 1-6", () => eachCampus(runShortageAlerts), tz);                 // attendance shortage, 6:30 pm
cron.schedule("0 19 * * 1-6", () => eachCampus(async (id) => { await runRiskScan(id); publish(id, ["risk"]); }), tz); // at-risk scan, 7 pm
cron.schedule("0 10 * * 1", () => eachCampus(runFeeReminders), tz);                        // fee reminders, Monday 10 am

// Warm the at-risk summary shortly after a restart.
setTimeout(() => eachCampus((id) => runRiskScan(id)), 5000);