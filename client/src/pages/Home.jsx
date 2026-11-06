import { Link } from "react-router-dom";
import { ArrowRight, CloudOff, Users } from "lucide-react";
import { useAuth } from "../auth.jsx";
import { useApi, useOfflineApi } from "../hooks.js";
import { greet, firstName, longDate, rupees } from "../utils.js";
import { PageHeader, Kpi, Panel, Skeleton, ErrorState, Empty } from "../components/ui.jsx";

const PIPE = [["DRAFT", "Draft"], ["SUBMITTED", "Awaiting moderation"], ["MODERATED", "Ready to lock"], ["LOCKED", "Locked"]];

function AdminHome() {
  const dash = useApi("/dashboard", ["masters", "attendance", "marks", "fees", "risk"]);
  const programmes = useApi("/masters/programmes", ["masters"]);
  if (dash.error) return <ErrorState error={dash.error} onRetry={dash.reload} />;
  if (dash.loading && !dash.data) return <Skeleton rows={3} />;
  const d = dash.data;
  const sheets = Object.values(d.marks).reduce((a, b) => a + b, 0);
  const net = d.fees.billed - d.fees.scholarship;
  const collected = net ? Math.min(100, Math.round((d.fees.paid / net) * 100)) : 0;

  return (
    <>
      <div className="kpis">
        <Kpi label="Students" value={d.students} note={`${d.faculty} faculty`} to="/students" />
        <Kpi label="Below 75% attendance" value={d.shortage} tone={d.shortage ? "risk" : undefined} note={d.attendancePct != null ? `${d.attendancePct}% overall` : "No data yet"} to="/alerts" />
        <Kpi label="At-risk flags" value={d.risk.open} tone={d.risk.high ? "risk" : undefined} note={`${d.risk.high} high risk`} to="/risk" />
        <Kpi label="Fees outstanding" value={rupees(d.fees.outstanding)} tone={d.fees.criticalCount ? "risk" : undefined} note={`${d.fees.owingCount} students`} to="/fees" />
        <Kpi label="Marks locked" value={`${d.marks.LOCKED ?? 0}/${sheets}`} note="sheets" to="/marks" />
      </div>
      <div className="cols">
        <Panel title="Attendance by subject">
          <div className="panel-body srows">
            {d.subjects.length ? d.subjects.map((s) => (
              <div key={s.code} className="srow">
                <span className="mono muted">{s.code}</span><span>{s.name}</span>
                <span className={`gauge ${s.pct != null && s.pct < 75 ? "risk" : ""}`}>
                  <span className="bar"><i style={{ width: `${s.pct ?? 0}%` }} /></span><b className="tnum">{s.pct != null ? `${s.pct.toFixed(1)}%` : "—"}</b></span>
              </div>)) : <Empty title="No attendance yet" />}
          </div>
        </Panel>
        <Panel title="Fee collection" meta={<Link to="/fees" className="muted" style={{ fontSize: 12 }}>Open ledger</Link>}>
          <div className="panel-body">
            <div className="stack" aria-label={`${collected}% collected`}><i style={{ width: `${collected}%` }} /></div>
            <div className="frow"><span>Collected</span><b className="tnum">{rupees(d.fees.paid)} <span className="muted">({collected}%)</span></b></div>
            <div className="frow"><span>Outstanding</span><b className="tnum">{rupees(d.fees.outstanding)}</b></div>
            <div className="frow"><span>Scholarships</span><b className="tnum">{rupees(d.fees.scholarship)}</b></div>
            <div className="frow"><span>Critical, over 60 days</span><b className={`tnum ${d.fees.criticalCount ? "redtxt" : ""}`}>{rupees(d.fees.critical)} · {d.fees.criticalCount}</b></div>
          </div>
        </Panel>
      </div>
      <div className="cols">
        <Panel title="Marks pipeline" meta={<Link to="/marks" className="muted" style={{ fontSize: 12 }}>Open marks</Link>}>
          <div className="panel-body">
            {PIPE.map(([k, l]) => <div key={k} className="frow"><span>{l}</span><b className="tnum">{d.marks[k] ?? 0}</b></div>)}
          </div>
        </Panel>
        <Panel title="Programmes">
          {programmes.data && (
            <div className="table-wrap"><table>
              <thead><tr><th>Programme</th><th>Batches</th><th className="num">Students</th></tr></thead>
              <tbody>{programmes.data.items.map((p) => (
                <tr key={p.id}><td>{p.name}</td>
                  <td>{p.batches.map((b) => <span key={b.id} className="badge" style={{ marginRight: 6 }}>{b.label}</span>)}</td>
                  <td className="num">{p.batches.reduce((n, b) => n + b._count.students, 0)}</td></tr>))}</tbody>
            </table></div>)}
        </Panel>
      </div>
    </>
  );
}

function MyClasses() {
  const { data, error, loading, reload, stale } = useOfflineApi("/masters/allocations", "allocations", ["masters"]);
  const risk = useApi("/risk?status=OPEN", ["risk"]);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading) return <Skeleton rows={3} />;
  const items = data.items;
  if (!items.length) return <Panel><Empty title="No classes yet" hint="Your office admin will allocate subjects to you." /></Panel>;

  const batches = new Map(items.map((a) => [a.batchId, a.batch._count.students]));
  const students = [...batches.values()].reduce((n, c) => n + c, 0);
  return (
    <>
      {stale && <div className="notice"><CloudOff size={16} /> Showing the list saved on this device.</div>}
      <div className="kpis">
        <Kpi label="Classes assigned" value={items.length} note="this term" />
        <Kpi label="Students" value={students} note={`across ${batches.size} ${batches.size === 1 ? "batch" : "batches"}`} />
        <Kpi label="Open mentor tasks" value={risk.data?.counts.open ?? "—"} tone={risk.data?.counts.high ? "risk" : undefined}
          note={risk.data ? `${risk.data.counts.high} high risk` : undefined} to="/risk" />
      </div>
      <Panel title="My classes" meta={<span className="muted" style={{ fontSize: 12 }}>{items.length} assigned</span>}>
        <div className="panel-body classes">
          {items.map((a) => (
            <article key={a.id} className="class">
              <div className="chips"><span className="badge">{a.subject.code}</span><span className="badge">Semester {a.subject.semester}</span></div>
              <h2>{a.subject.name}</h2>
              <p className="meta">B.Tech {a.batch.programme.code} · Batch {a.batch.label}</p>
              <div className="strip">
                <span className="l"><Users size={15} /> {a.batch._count.students} students</span>
                <Link className="btn" to={`/attendance/${a.id}`}>Take attendance <ArrowRight size={15} /></Link>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </>
  );
}

export default function Home() {
  const { user } = useAuth();
  const admin = user.role === "ADMIN";
  return (
    <div className="page">
      <PageHeader eyebrow={admin ? "Office administration" : "Faculty workspace"} title={`${greet()}, ${firstName(user.name)}`} sub={longDate()} />
      {admin ? <AdminHome /> : <MyClasses />}
    </div>
  );
}