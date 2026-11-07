import autocannon from "autocannon";

const base = process.env.BASE_URL ?? "http://localhost:4000";
const login = await fetch(`${base}/api/auth/login`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: process.env.LT_EMAIL ?? "admin@sutra.demo", password: process.env.LT_PASSWORD ?? "Sutra@2026" }),
});
if (!login.ok) throw new Error(`Login failed: ${login.status}`);
const cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const paths = ["/api/dashboard", "/api/fees/dues?status=due", "/api/students?pageSize=25", "/api/health"];
const conn = Number(process.env.CONN ?? 50);
console.log(`Connections: ${conn}, ${process.env.SECS ?? 15}s per path`);

for (const p of paths) await fetch(base + p, { headers: { cookie } }).catch(() => {}); // warm-up, also wakes Neon
await sleep(3000);

const rows = [];
for (const p of paths) {
  const r = await autocannon({ url: base + p, connections: conn, duration: Number(process.env.SECS ?? 15), headers: { cookie } });
  rows.push({ path: p, "req/s": Math.round(r.requests.average), "p50 ms": r.latency.p50, "p99 ms": r.latency.p99, errors: r.errors + r.timeouts, non2xx: r.non2xx });
  await sleep(Number(process.env.DRAIN_MS ?? 12000)); // let the server finish queued work before the next path
}
console.table(rows);