let es = null, opened = false;
const subs = new Set();
const emit = (t) => subs.forEach((f) => f(t));

export function connectLive() {
  if (es || typeof EventSource === "undefined") return;
  es = new EventSource("/api/events"); // same origin, so the session cookie is sent
  es.onopen = () => { if (opened) emit(["*"]); opened = true; }; // after a reconnect, refresh everything
  es.onmessage = (e) => { try { emit(JSON.parse(e.data).topics); } catch { /* ignore */ } };
}
export function disconnectLive() { es?.close(); es = null; opened = false; }
export const onLive = (f) => { subs.add(f); return () => subs.delete(f); };