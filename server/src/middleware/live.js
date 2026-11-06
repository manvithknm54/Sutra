import { publish } from "../lib/events.js";
import { scheduleRiskScan } from "../lib/risk.js";

export const notifyOnWrite = (topics, { scan = false } = {}) => (req, res, next) => {
  if (req.method !== "GET") {
    res.on("finish", () => {
      if (res.statusCode >= 400) return;
      publish(req.user.campusId, topics);
      if (scan) scheduleRiskScan(req.user.campusId);
    });
  }
  next();
};