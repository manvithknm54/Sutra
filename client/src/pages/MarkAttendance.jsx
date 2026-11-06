import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, CheckCircle2, CloudOff, Search, X } from "lucide-react";
import { api } from "../api";
import { useSync } from "../hooks.js";
import { getRoster, listQueue, saveRoster, submitAttendance } from "../lib/offline.js";
import { longDate } from "../utils.js";
import { Empty, ErrorState, Kpi, PageHeader, Panel, Skeleton } from "../components/ui.jsx";

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];
const todayLocal = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time

async function loadRoster(id) {
  try {
    const data = await api(`/attendance/roster/${id}`);
    await saveRoster(data);
    return { data, source: "network", savedAt: Date.now() };
  } catch (e) {
    if (!e.offline) throw e;
    const cached = await getRoster(id);
    if (cached) return { data: cached.data, source: "cache", savedAt: cached.savedAt };
    throw Object.assign(new Error("This class list isn't saved on this device yet. Open it once while online."), { offline: true });
  }
}

const Gauge = ({ s }) =>
  s.pct == null ? <span className="gauge muted">No data</span> : (
    <span className={`gauge ${s.shortage ? "risk" : ""}`}>
      <span className="bar"><i style={{ width: `${Math.min(100, s.pct)}%` }} /></span>
      <b className="tnum">{s.pct.toFixed(1)}%</b>
    </span>
  );

const Dots = ({ v }) => (
  <span className="dots" aria-label="Last three periods">
    {v.map((x, i) => <i key={i} className={x === "A" ? "a" : x === "P" ? "" : "n"} />)}
  </span>
);

function MarkAttendanceView() {
  const { allocationId } = useParams();
  const sync = useSync();
  const [load, setLoad] = useState({ loading: true });
  const [queued, setQueued] = useState([]);
  const [absent, setAbsent] = useState(() => new Set());
  const [period, setPeriod] = useState(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [done, setDone] = useState(null);
  const [doneState, setDoneState] = useState("pending");
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const t0 = useRef(performance.now());
  const date = todayLocal();

  useEffect(() => {
    let alive = true;
    setLoad({ loading: true });
    loadRoster(allocationId)
      .then((r) => { if (alive) { setLoad({ loading: false, ...r }); t0.current = performance.now(); } })
      .catch((error) => alive && setLoad({ loading: false, error }));
    return () => { alive = false; };
  }, [allocationId]);

  useEffect(() => {
    listQueue().then((l) => setQueued(l.filter((i) => i.allocationId === allocationId)));
  }, [allocationId, done, sync.pending]);

  const data = load.data;
  const taken = useMemo(
    () => new Set([...(data?.markedPeriods ?? []), ...queued.filter((i) => i.date === date).map((i) => i.period)]),
    [data, queued, date]
  );
  useEffect(() => {
    if (data && period === null) setPeriod(PERIODS.find((p) => !taken.has(p)) ?? 0);
  }, [data, taken, period]);

  // After submit: follow this one session until the server has it.
  useEffect(() => {
    if (!done) return;
    listQueue().then((l) => setDoneState(l.find((i) => i.id === done.id) ?? "synced"));
  }, [done, sync.pending, sync.problems, sync.lastSyncAt]);

  const students = useMemo(() => (data?.students ?? []).map((s, i) => ({ ...s, n: i + 1 })), [data]);
  const needle = q.trim().toLowerCase();
  const list = students.filter(
    (s) =>
      (!needle || s.name.toLowerCase().includes(needle) || s.rollNo.toLowerCase().includes(needle)) &&
      (filter === "all" || (filter === "absent" && absent.has(s.id)) || (filter === "risk" && s.shortage))
  );
  const total = students.length;
  const absentN = absent.size;
  const riskN = students.filter((s) => s.shortage).length;
  const toggle = (id) => setAbsent((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function submit() {
    if (!data || done || busy || !period || taken.has(period)) return;
    setBusy(true); setSaveError("");
    try {
      const secs = Math.max(1, Math.round((performance.now() - t0.current) / 1000));
      const id = await submitAttendance({
        allocationId, date, period, absentIds: [...absent],
        label: `${data.allocation.subject.code} · ${data.allocation.subject.name}`,
      });
      setDone({ id, secs, absent: absentN, total, period });
    } catch {
      setSaveError("Couldn't save on this device. Check storage and try again.");
    } finally { setBusy(false); }
  }
  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submit(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  function another() {
    setDone(null); setAbsent(new Set()); setPeriod(null); setQ(""); setFilter("all"); t0.current = performance.now();
  }

  const back = <Link to="/" className="back"><ArrowLeft size={15} /> Back to my classes</Link>;
  if (load.loading) return <div className="page">{back}<Skeleton rows={8} /></div>;
  if (load.error) return <div className="page">{back}<Panel><ErrorState error={load.error} /></Panel></div>;

  const { subject, batch } = data.allocation;

  if (done) {
    const item = typeof doneState === "object" ? doneState : null;
    const status = item ? item.state : "synced";
    return (
      <div className="page">
        {back}
        <Panel>
          <div className="done">
            <CheckCircle2 size={36} />
            <h2>Attendance saved · marked in {done.secs}s</h2>
            <p>{subject.code} · Period {done.period} · {done.total - done.absent} present, {done.absent} absent</p>
            <p className="muted" role="status">
              {status === "synced" && "Synced to the server."}
              {status === "pending" && (sync.online ? "Saved on this device. Syncing…" : "Saved on this device. It will sync when you're back online.")}
              {status === "conflict" && (item?.message || "This period was already marked from another device.")}
              {status === "rejected" && (item?.message || "The server couldn't accept this.")}
            </p>
            <div className="row">
              <button className="btn" onClick={another}>Mark another period</button>
              {(status === "conflict" || status === "rejected")
                ? <Link className="btn secondary" to="/attendance">Review</Link>
                : <Link className="btn secondary" to="/">Back to my classes</Link>}
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="page">
      {back}
      <PageHeader
        eyebrow={longDate()}
        title={`Mark attendance · ${subject.code}`}
        sub={`${subject.name} · B.Tech ${batch.programme.code} · Semester ${subject.semester} · Batch ${batch.label}`}
        action={
          <div className="field" style={{ minWidth: 150 }}>
            <label htmlFor="period">Period</label>
            <select id="period" className="select" value={period ?? ""} onChange={(e) => setPeriod(Number(e.target.value))}>
              {PERIODS.map((p) => <option key={p} value={p} disabled={taken.has(p)}>Period {p}{taken.has(p) ? " · marked" : ""}</option>)}
            </select>
          </div>
        }
      />

      {!sync.online && (
        <div className="notice" role="status"><CloudOff size={16} /> You're offline. Attendance is saved on this device and syncs automatically.</div>
      )}
      {load.source === "cache" && (
        <div className="notice"><CloudOff size={16} /> Class list saved on this device {new Date(load.savedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}.</div>
      )}

      <div className="kpis">
        <Kpi label="Enrolled" value={total} />
        <Kpi label="Present" value={total - absentN} />
        <Kpi label="Absent" value={absentN} tone={absentN ? "risk" : undefined} />
        <Kpi label="Session rate" value={total ? `${(((total - absentN) / total) * 100).toFixed(1)}%` : "—"} />
      </div>

      <div className="controls">
        <div className="search">
          <Search size={16} />
          <input className="input" placeholder="Find by name or roll number" aria-label="Find student" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="seg" style={{ margin: 0 }} role="tablist">
          {[["all", `All (${total})`], ["absent", `Absent (${absentN})`], ["risk", `Below 75% (${riskN})`]].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <button className="btn secondary" onClick={() => setAbsent(new Set())} disabled={!absentN}>Mark all present</button>
      </div>

      <Panel>
        {!list.length ? <Empty title="No students match" hint="Clear the search or switch the filter." /> : (
          <>
            <div className="ahead label">
              <span>#</span><span>Student</span><span>Aggregate attendance</span><span style={{ textAlign: "center" }}>Last 3</span><span>Mark</span>
            </div>
            <ul className="alist">
              {list.map((s) => {
                const isAbsent = absent.has(s.id);
                return (
                  <li key={s.id}>
                    <button type="button" className={`arow ${isAbsent ? "absent" : ""}`} aria-pressed={isAbsent} onClick={() => toggle(s.id)}>
                      <span className="idx tnum">{String(s.n).padStart(2, "0")}</span>
                      <span className="who2"><b>{s.name}</b><span className="mono muted">{s.rollNo}</span></span>
                      <Gauge s={s} />
                      <Dots v={s.last3} />
                      <span className="pill">{isAbsent ? <X size={15} /> : <Check size={15} />}{isAbsent ? "Absent" : "Present"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>

      <div className="submitbar">
        <span className="count tnum">{total - absentN} present · {absentN} absent <span className="muted" style={{ fontWeight: 400 }}>of {total}</span></span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {saveError && <span className="helper-err" style={{ margin: 0 }} role="alert">{saveError}</span>}
          <button className="btn" onClick={submit} disabled={busy || !period || taken.has(period)}>
            {busy ? "Saving…" : "Submit attendance"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MarkAttendance() {
  const { allocationId } = useParams();
  return <MarkAttendanceView key={allocationId} />;
}