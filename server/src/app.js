import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth.js";
import mastersRouter from "./routes/masters.js";
import studentsRouter from "./routes/students.js";
import attendanceRouter from "./routes/attendance.js";
import marksRouter from "./routes/marks.js";
import feesRouter from "./routes/fees.js";
import riskRouter from "./routes/risk.js";
import alertsRouter from "./routes/alerts.js";
import dashboardRouter from "./routes/dashboard.js";
import eventsRouter from "./routes/events.js";
import publicRouter from "./routes/public.js";
import assistantRouter from "./routes/assistant.js";
import { requireAuth, requireRole } from "./middleware/auth.js";
import { notifyOnWrite } from "./middleware/live.js";

export const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(compression({ filter: (req, res) => (req.originalUrl.startsWith("/api/events") ? false : compression.filter(req, res)) }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "sutra-api", time: new Date().toISOString() }));

app.use("/api/auth", authRouter);
app.use("/api/public", publicRouter);
app.use("/api/events", requireAuth, eventsRouter);
app.use("/api/masters", requireAuth, notifyOnWrite(["masters"]), mastersRouter);
app.use("/api/students", requireAuth, notifyOnWrite(["masters", "attendance", "fees"]), studentsRouter);
app.use("/api/attendance", requireAuth, notifyOnWrite(["attendance", "risk"], { scan: true }), attendanceRouter);
app.use("/api/marks", requireAuth, notifyOnWrite(["marks", "risk"], { scan: true }), marksRouter);
app.use("/api/fees", requireAuth, requireRole("ADMIN"), notifyOnWrite(["fees"]), feesRouter);
app.use("/api/risk", requireAuth, notifyOnWrite(["risk"]), riskRouter);
app.use("/api/alerts", requireAuth, requireRole("ADMIN"), alertsRouter);
app.use("/api/dashboard", requireAuth, requireRole("ADMIN"), dashboardRouter);
app.use("/api/assistant", requireAuth, requireRole("ADMIN"), assistantRouter);

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});