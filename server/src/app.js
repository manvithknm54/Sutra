import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth.js";
import mastersRouter from "./routes/masters.js";
import studentsRouter from "./routes/students.js";
import { requireAuth } from "./middleware/auth.js";

export const app = express();

app.set("trust proxy", 1); // Render sits behind a proxy
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "sutra-api", time: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/masters", requireAuth, mastersRouter);
app.use("/api/students", requireAuth, studentsRouter);

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});