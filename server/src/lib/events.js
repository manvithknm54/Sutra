import { bust } from "./cache.js";

// In-memory pub/sub per campus. Fine for one server; use Redis pub/sub if you ever run several (noted in the TDD).
const clients = new Set();

export function addClient(res, campusId) {
  const c = { res, campusId };
  clients.add(c);
  return () => clients.delete(c);
}

// Events carry only topic names, never data.
export function publish(campusId, topics) {
  bust(campusId);
  const msg = `data: ${JSON.stringify({ topics })}\n\n`;
  for (const c of clients) if (c.campusId === campusId) c.res.write(msg);
}