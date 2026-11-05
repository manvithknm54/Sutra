import { openDB } from "idb";
import { api } from "../api";

// Everything a teacher needs in a dead-signal classroom lives here.
const dbp = openDB("sutra-offline", 1, {
  upgrade(db) {
    db.createObjectStore("roster", { keyPath: "allocationId" }); // class lists
    db.createObjectStore("queue", { keyPath: "id" });            // attendance waiting to sync
    db.createObjectStore("meta", { keyPath: "key" });            // small cached lists
  },
});

export const saveRoster = async (data) => (await dbp).put("roster", { allocationId: data.allocation.id, data, savedAt: Date.now() });
export const getRoster = async (id) => (await dbp).get("roster", id);
export const cachePut = async (key, value) => (await dbp).put("meta", { key, value });
export const cacheGet = async (key) => (await (await dbp).get("meta", key))?.value ?? null;
export const listQueue = async () => (await dbp).getAll("queue");

// ---- tiny observable store, read in React via useSync() ----
let snap = {
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  pending: 0, problems: 0, syncing: false, lastSyncAt: null,
};
const subs = new Set();
const set = (patch) => { snap = { ...snap, ...patch }; subs.forEach((f) => f()); };
export const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
export const getSnapshot = () => snap;

export async function refreshCounts() {
  const q = await listQueue();
  set({ pending: q.filter((i) => i.state === "pending").length, problems: q.filter((i) => i.state !== "pending").length });
}

export async function discardQueued(id) {
  await (await dbp).delete("queue", id);
  await refreshCounts();
}

// Saved on the device first, always. The network is only ever a bonus.
export async function submitAttendance({ allocationId, date, period, absentIds, label }) {
  const item = {
    id: crypto.randomUUID(), // the server upserts on this id, so a retry can never double-count
    allocationId, date, period, absentIds, label,
    deviceTime: new Date().toISOString(), state: "pending", createdAt: Date.now(),
  };
  await (await dbp).put("queue", item);
  await refreshCounts();
  syncNow();
  return item.id;
}

let running = false;
export async function syncNow() {
  if (running || !navigator.onLine) return;
  running = true;
  set({ syncing: true });
  try {
    const items = (await listQueue()).filter((i) => i.state === "pending");
    for (let i = 0; i < items.length; i += 20) {
      const chunk = items.slice(i, i + 20);
      const { results } = await api("/attendance/sync", {
        method: "POST",
        body: { sessions: chunk.map(({ id, allocationId, date, period, deviceTime, absentIds }) => ({ id, allocationId, date, period, deviceTime, absentIds })) },
      });
      for (const r of results) {
        const item = chunk.find((c) => c.id === r.id);
        if (["created", "duplicate", "updated"].includes(r.status)) (await dbp).delete("queue", r.id);
        else if (r.status === "conflict" || r.status === "rejected")
          (await dbp).put("queue", { ...item, state: r.status, message: r.reason });
        // status "error": leave it pending and retry on the next pass
      }
    }
    set({ lastSyncAt: Date.now() });
    prefetchRosters(); // refresh percentages after new data lands
  } catch {
    // network or session problem: the queue is untouched and we try again later
  } finally {
    running = false;
    set({ syncing: false });
    await refreshCounts();
  }
}

// Download every class list while the signal is good, so class works with none.
export async function prefetchRosters() {
  if (!navigator.onLine) return;
  try {
    const a = await api("/masters/allocations");
    await cachePut("allocations", a);
    await Promise.all(a.items.map(async (x) => saveRoster(await api(`/attendance/roster/${x.id}`))));
  } catch { /* offline or signed out: ignore */ }
}

// Weak classroom Wi-Fi: we don't trust navigator.onLine alone, so we also retry on a timer and on app focus.
export function initSync() {
  const on = () => { set({ online: true }); syncNow(); prefetchRosters(); };
  const off = () => set({ online: false });
  const vis = () => { if (document.visibilityState === "visible") syncNow(); };
  window.addEventListener("online", on);
  window.addEventListener("offline", off);
  document.addEventListener("visibilitychange", vis);
  const timer = setInterval(() => { if (snap.pending) syncNow(); }, 30000);
  set({ online: navigator.onLine });
  refreshCounts().then(() => { syncNow(); prefetchRosters(); });
  return () => {
    window.removeEventListener("online", on);
    window.removeEventListener("offline", off);
    document.removeEventListener("visibilitychange", vis);
    clearInterval(timer);
  };
}