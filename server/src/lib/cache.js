// Short-lived cache per campus. Concurrent requests share one computation (no stampede on results day),
// and any write busts it. An unset or blank CACHE_TTL_MS means the 5-second default; only an explicit 0 turns it off.
const raw = process.env.CACHE_TTL_MS;
const parsed = Number(raw);
const ttl = raw != null && raw.trim() !== "" && Number.isFinite(parsed) && parsed >= 0 ? parsed : 5000;
const store = new Map();

export function cached(campusId, key, fn) {
  if (!ttl) return fn();
  const k = `${campusId}|${key}`, hit = store.get(k);
  if (hit && Date.now() - hit.at < ttl) return hit.p; // the stored promise is shared by concurrent callers
  const p = fn();
  store.set(k, { at: Date.now(), p });
  p.catch(() => store.delete(k));
  return p;
}
export function bust(campusId) {
  for (const k of store.keys()) if (k.startsWith(`${campusId}|`)) store.delete(k);
}