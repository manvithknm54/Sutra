import { Router } from "express";
import { addClient } from "../lib/events.js";

const router = Router();

router.get("/", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write("retry: 5000\n\n");
  const remove = addClient(res, req.user.campusId);
  const beat = setInterval(() => res.write(": ping\n\n"), 25000);
  req.on("close", () => { clearInterval(beat); remove(); });
});

export default router;