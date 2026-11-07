import { useState } from "react";
import { Download, Send, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "../api";
import { downloadCsv, rupees } from "../utils.js";
import { Panel, PageHeader, Skeleton } from "../components/ui.jsx";

const EXAMPLES = [
  "How many third-year students are below 75% attendance this month?",
  "Which CSE students have overdue fees of more than ₹20,000?",
  "Show high risk students",
  "Minors whose guardian consent is pending",
  "Students below 75% attendance who also have fees due",
];
const SOURCE = { ai: "Interpreted by AI", rules: "Interpreted by rules", replay: "Re-run from the same query" };

export default function Ask() {
  const [q, setQ] = useState("");
  const [state, setState] = useState({});
  async function run(body) {
    setState({ loading: true });
    try { setState({ res: await api("/assistant/ask", { method: "POST", body }) }); }
    catch (e) { setState({ error: e }); }
  }
  const submit = (e) => { e.preventDefault(); if (q.trim().length >= 3) run({ question: q.trim() }); };
  const { res, loading, error } = state;

  return (
    <div className="page">
      <PageHeader eyebrow="Office assistant" title="Ask Sutra" sub="Ask about students in plain English. It reads your records and never changes them." />
      <Panel>
        <div className="panel-body">
          <form className="askbar" onSubmit={submit}>
            <input className="input" value={q} maxLength={300} aria-label="Your question" placeholder="e.g. How many third-year students are below 75% this month?"
              onChange={(e) => setQ(e.target.value)} />
            <button className="btn" disabled={loading || q.trim().length < 3}><Send size={15} /> Ask</button>
          </form>
          <div className="qchips">
            {EXAMPLES.map((x) => <button key={x} className="qchip" onClick={() => { setQ(x); run({ question: x }); }}>{x}</button>)}
          </div>
        </div>
      </Panel>

      {loading && <Skeleton rows={4} />}
      {error && (
        <div className="callout" role="alert"><Sparkles size={16} /><span><b>{error.message}</b><br />{`Try: "How many third-year students are below 75% attendance this month?"`}</span></div>
      )}
      {res && !loading && (
        <Panel title="Result" meta={<span className="badge">{SOURCE[res.source]}</span>}>
          <div className="panel-body" style={{ display: "grid", gap: 16 }}>
            <div>
              <p className="label" style={{ marginBottom: 8 }}>Understood as</p>
              <div className="tags">
                {res.understood.length ? res.understood.map(([k, v], i) => <span key={i} className="tag"><span>{k}</span> <b>{v}</b></span>)
                  : <span className="tag"><span>All students</span></span>}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <span className="bigcount tnum">{res.total}</span>
              <span className="muted">{res.total === 1 ? "student matches" : "students match"}</span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                {res.spec.select === "count" && res.total > 0 && (
                  <button className="btn secondary" onClick={() => run({ spec: { ...res.spec, select: "list" } })}>Show these students</button>)}
                {res.rows.length > 0 && (
                  <button className="btn secondary" onClick={() => downloadCsv(`sutra-query-${new Date().toISOString().slice(0, 10)}.csv`,
                    ["Roll No", "Name", "Programme", "Study year", "Attendance %", "Fee due (INR)", "Risk score"],
                    res.rows.map((r) => [r.rollNo, r.name, r.programme, r.year, r.attendancePct ?? "", r.due / 100, r.risk ?? ""]))}>
                    <Download size={15} /> Export CSV</button>)}
              </span>
            </div>
            {res.notes.map((n, i) => <div key={i} className="notice" style={{ margin: 0 }}>{n}</div>)}
            {res.rows.length > 0 && (
              <div className="table-wrap" style={{ border: "1px solid var(--line)", borderRadius: 10 }}><table>
                <thead><tr><th>Roll no</th><th>Student</th><th>Programme</th><th className="num">Year</th><th className="num">Attendance</th><th className="num">Fees due</th><th className="num">Risk</th></tr></thead>
                <tbody>{res.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.rollNo}</td><td style={{ fontWeight: 500 }}>{r.name}</td><td>{r.programme}</td>
                    <td className="num">{r.year}</td>
                    <td className={`num ${r.attendancePct != null && r.attendancePct < 75 ? "redtxt" : ""}`}>{r.attendancePct != null ? `${r.attendancePct}%` : "—"}</td>
                    <td className={`num ${r.due > 0 ? "redtxt" : ""}`}>{rupees(r.due)}</td>
                    <td className="num">{r.risk ?? "—"}</td>
                  </tr>))}</tbody>
              </table></div>
            )}
            <details className="spec"><summary>View the structured query</summary><pre>{JSON.stringify(res.spec, null, 2)}</pre></details>
            <p className="muted" style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "center" }}>
              <ShieldCheck size={14} /> Read-only. This assistant can only look at records on your campus. It cannot change attendance, marks, fees or consent.
            </p>
          </div>
        </Panel>
      )}
    </div>
  );
}