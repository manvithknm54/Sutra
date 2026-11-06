import { useState } from "react";
import { Check, CheckCheck, RefreshCw, Search, ShieldAlert, X } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { timeIN } from "../utils.js";
import { Empty, ErrorState, Kpi, Modal, PageHeader, Panel, Skeleton } from "../components/ui.jsx";
import { ReasonDialog } from "../components/dialogs.jsx";

const LEVEL = { HIGH: ["High", "risk"], MEDIUM: ["Medium", ""] };
const STATUS = { OPEN: "Open", DISMISSED: "Dismissed", ACTIONED: "Done" };

function Detail({ f, onClose, onChanged }) {
  const [dialog, setDialog] = useState(null);
  const sg = f.reasons.signals ?? {};
  const tiles = [
    ["Attendance", sg.attendancePct != null ? `${sg.attendancePct}%` : "—"],
    ["Last 4 weeks", sg.recentPct != null ? `${sg.recentPct}%` : "—"],
    ["Internal marks", sg.marksPct != null ? `${sg.marksPct}%` : "—"],
    ["Class average", sg.classAvgPct != null ? `${sg.classAvgPct}%` : "—"],
  ];
  return (
    <Modal side flush icon={ShieldAlert} tone={f.level === "HIGH" ? "risk" : ""} title={f.student.name}
      sub={`${f.student.rollNo} · ${f.student.batch.programme.code} · Batch ${f.student.batch.label}`} onClose={onClose}>
      <div className="ledger-body">
        <div className="risk-score"><span className="label">Risk score</span>
          <b className="tnum">{f.score}<small>/100</small></b><span className={`badge ${LEVEL[f.level][1]}`}>{LEVEL[f.level][0]} risk</span></div>
        <dl className="facts">{tiles.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="tnum">{v}</dd></div>)}</dl>
        <h3 className="label">Why this student is flagged</h3>
        <ul className="why">{f.reasons.items.map((r, i) => (
          <li key={i}><span className="pts">+{r.points}</span><span>{r.text}</span></li>))}</ul>
        <div className="callout"><ShieldAlert size={16} /><span>This flag only created a mentor task. It never changes attendance, marks or fees. The score is a set of fixed rules, not a prediction.</span></div>
        <div className="muted" style={{ fontSize: 13 }}>Mentor: <b style={{ color: "var(--ink)" }}>{f.mentor?.name ?? "Unassigned"}</b> · Flagged {timeIN(f.createdAt)}</div>
        {f.status !== "OPEN" && (
          <div className="notice" style={{ margin: 0 }}>{f.status === "ACTIONED" ? `Marked done${f.taskNote ? `: ${f.taskNote}` : "."}` : `Dismissed: ${f.dismissReason}`}</div>)}
        {f.canAct && (
          <div className="actions" style={{ justifyContent: "flex-start" }}>
            <button className="btn" onClick={() => setDialog("done")}><CheckCheck size={15} /> Mark task done</button>
            <button className="btn secondary" onClick={() => setDialog("dismiss")}><X size={15} /> Dismiss flag</button>
          </div>)}
      </div>
      {dialog === "done" && <ReasonDialog title="Mark mentor task done" body="Record what you did, for example a one-to-one meeting." icon={CheckCheck}
        label="Note (optional)" optional confirm="Mark done" onClose={() => setDialog(null)}
        onConfirm={async (note) => { await api(`/risk/${f.id}/done`, { method: "POST", body: { note: note || undefined } }); onChanged("Task marked done."); onClose(); }} />}
      {dialog === "dismiss" && <ReasonDialog title="Dismiss this flag" body="Say why this student doesn't need follow-up. The reason is kept on record." icon={X} danger
        label="Reason" confirm="Dismiss flag" onClose={() => setDialog(null)}
        onConfirm={async (reason) => { await api(`/risk/${f.id}/dismiss`, { method: "POST", body: { reason } }); onChanged("Flag dismissed."); onClose(); }} />}
    </Modal>
  );
}

export default function Risk() {
  const { user } = useAuth();
  const admin = user.role === "ADMIN";
  const [status, setStatus] = useState("OPEN");
  const [level, setLevel] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [note, setNote] = useState(null);
  const [scanning, setScanning] = useState(false);
  const { data, error, loading, reload } = useApi(`/risk?status=${status}`, ["risk"]);

  const items = (data?.items ?? []).filter((f) =>
    (level === "all" || f.level === level.toUpperCase()) &&
    (!q.trim() || f.student.name.toLowerCase().includes(q.trim().toLowerCase()) || f.student.rollNo.toLowerCase().includes(q.trim().toLowerCase())));
  const current = open && data?.items.find((f) => f.id === open);
  const c = data?.counts;
  const scan = data?.lastScan;

  async function runScan() {
    setScanning(true);
    try { const r = await api("/risk/scan", { method: "POST" }); setNote(`Scan finished: ${r.flagged} flagged, ${r.created} new, ${r.insufficient} with not enough data.`); reload(); }
    catch (e) { setNote(e.message); } finally { setScanning(false); }
  }

  return (
    <div className="page">
      <PageHeader eyebrow={admin ? "Early intervention" : "Mentoring"} title="At-risk students"
        sub={admin ? "Students whose attendance and marks point to trouble. Each flag creates one mentor task." : "Your mentees who may need a conversation."}
        action={admin && <button className="btn secondary" onClick={runScan} disabled={scanning}><RefreshCw size={15} /> {scanning ? "Scanning…" : "Run scan now"}</button>} />
      <div className="callout" style={{ marginBottom: 16 }}><ShieldAlert size={16} />
        <span>Flags only create a mentor task. They never change attendance, marks or fees. Every flag shows exactly why it was raised.</span></div>
      {note && <div className="notice" role="status"><Check size={16} /> {note}</div>}
      {c && (
        <div className="kpis">
          <Kpi label="Open flags" value={c.open} /><Kpi label="High risk" value={c.high} tone={c.high ? "risk" : undefined} />
          <Kpi label="Medium risk" value={c.medium} /><Kpi label="Closed" value={c.closed} note="done or dismissed" />
        </div>)}
      <div className="controls">
        <div className="search"><Search size={16} />
          <input className="input" placeholder="Find by name or roll number" aria-label="Find student" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="seg" style={{ margin: 0 }} role="tablist">
          {[["all", "All levels"], ["high", "High"], ["medium", "Medium"]].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={level === k} className={level === k ? "on" : ""} onClick={() => setLevel(k)}>{l}</button>))}
        </div>
        <div className="seg" style={{ margin: 0 }} role="tablist">
          {Object.entries(STATUS).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={status === k} className={status === k ? "on" : ""} onClick={() => setStatus(k)}>{l}</button>))}
        </div>
      </div>
      <Panel>
        {error ? <ErrorState error={error} onRetry={reload} />
          : loading && !data ? <Skeleton />
          : !items.length ? <Empty title={status === "OPEN" ? "No students flagged" : "Nothing here"} hint="Flags appear when attendance and marks together point to risk." />
          : (
            <div className="table-wrap"><table>
              <thead><tr><th>Student</th><th>Risk</th><th>Why</th><th>Mentor</th><th></th></tr></thead>
              <tbody>{items.map((f) => (
                <tr key={f.id} className="click" tabIndex={0} onClick={() => setOpen(f.id)} onKeyDown={(e) => e.key === "Enter" && setOpen(f.id)}>
                  <td><b style={{ fontWeight: 500 }}>{f.student.name}</b><div className="mono muted" style={{ fontSize: 12 }}>{f.student.rollNo}</div></td>
                  <td><span className={`badge ${LEVEL[f.level][1]}`}>{LEVEL[f.level][0]}</span> <span className="tnum" style={{ marginLeft: 6 }}>{f.score}</span></td>
                  <td style={{ whiteSpace: "normal", maxWidth: 420 }}>
                    {f.reasons.items.slice(0, 2).map((r, i) => <div key={i} style={{ fontSize: 13 }}>{r.text}</div>)}
                    {f.reasons.items.length > 2 && <span className="muted" style={{ fontSize: 12 }}>+{f.reasons.items.length - 2} more</span>}
                  </td>
                  <td>{f.mentor?.name ?? "—"}</td>
                  <td className="num"><span className="btn secondary" style={{ height: 30 }}>Review</span></td>
                </tr>))}</tbody>
            </table></div>
          )}
        <div className="panel-foot">
          <span>{scan ? `Last scan ${timeIN(scan.at)}: ${scan.assessed} assessed, ${scan.insufficient} with not enough data to judge.` : "No scan since the server started."}</span>
          <span>Needs 10+ sessions or a completed mark sheet.</span>
        </div>
      </Panel>
      {current && <Detail f={current} onClose={() => setOpen(null)} onChanged={(t) => { setNote(t); reload(); }} />}
    </div>
  );
}