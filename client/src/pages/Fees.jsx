import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Award, Check, Copy, Download, ExternalLink, Link2, Plus, Search, Wallet } from "lucide-react";
import { api } from "../api";
import { useApi, useDebounced } from "../hooks.js";
import { dateIN, rupees } from "../utils.js";
import { Empty, ErrorState, Kpi, Modal, PageHeader, Panel, Skeleton } from "../components/ui.jsx";

const STATUS = { PENDING: ["Not yet due", ""], OVERDUE: ["Overdue", "risk"], CRITICAL: ["Critical", "risk"], CLEARED: ["Cleared", "ok"] };
const FeeBadge = ({ s }) => <span className={`badge ${STATUS[s][1]}`}><span className="dot" />{STATUS[s][0]}</span>;
const aging = (r) => (r.due <= 0 ? "—" : r.overdueDays > 0 ? `${r.overdueDays} days overdue` : "Not yet due");
const METHODS = [["COUNTER", "Counter"], ["UPI", "UPI"], ["CARD", "Card"], ["BANK", "Bank transfer"]];
const TYPE = { CHARGE: ["Charge", ""], PAYMENT: ["Payment", "ok"], SCHOLARSHIP: ["Scholarship", "ok"] };

function CopyBtn({ text, label = "Copy" }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ }
  }
  return <button type="button" className="btn secondary" onClick={copy}>{done ? <Check size={14} /> : <Copy size={14} />}{done ? "Copied" : label}</button>;
}

function PayDialog({ st, due, onClose, onDone }) {
  const key = useRef(crypto.randomUUID()); // one key per open dialog, so a double-click is one payment
  const [amount, setAmount] = useState(String(due / 100));
  const [method, setMethod] = useState("COUNTER");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const n = Number(amount);
  const valid = Number.isInteger(n) && n >= 1 && n * 100 <= due;
  async function go() {
    setBusy(true); setErr("");
    try {
      const r = await api(`/fees/student/${st.id}/payments`, { method: "POST",
        body: { amountRupees: n, method, reference: reference.trim() || undefined, key: key.current } });
      onDone(`Payment of ${rupees(n * 100)} recorded. Receipt ${r.entry.receiptNo}.`, r.entry.id);
      onClose();
    } catch (e) { setErr(e.message); setBusy(false); }
  }
  return (
    <Modal title="Record payment" sub={`${st.name} · ${rupees(due)} due`} icon={Wallet} onClose={onClose} footer={<>
      <button className="btn secondary" onClick={onClose}>Cancel</button>
      <button className="btn" disabled={!valid || busy} onClick={go}>{busy ? "Saving…" : "Record payment"}</button>
    </>}>
      <div className="field"><label htmlFor="amt">Amount (₹)</label>
        <input id="amt" className="input" type="number" min="1" step="1" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
        {amount !== "" && !valid && <p className="helper-err">Whole rupees, up to {rupees(due)}.</p>}</div>
      <div className="field"><label htmlFor="mth">Method</label>
        <select id="mth" className="select" value={method} onChange={(e) => setMethod(e.target.value)}>
          {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      <div className="field"><label htmlFor="ref">Reference (optional)</label>
        <input id="ref" className="input" maxLength={60} placeholder="UPI or cheque number" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
      {err && <p className="helper-err" role="alert">{err}</p>}
    </Modal>
  );
}

function ScholarshipDialog({ st, due, onClose, onDone }) {
  const key = useRef(crypto.randomUUID());
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const n = Number(amount);
  const valid = Number.isInteger(n) && n >= 1 && n * 100 <= due && reason.trim().length >= 5;
  async function go() {
    setBusy(true); setErr("");
    try {
      await api(`/fees/student/${st.id}/scholarships`, { method: "POST", body: { amountRupees: n, reason: reason.trim(), key: key.current } });
      onDone(`Scholarship of ${rupees(n * 100)} applied.`); onClose();
    } catch (e) { setErr(e.message); setBusy(false); }
  }
  return (
    <Modal title="Add scholarship" sub={`${st.name} · ${rupees(due)} due`} icon={Award} onClose={onClose} footer={<>
      <button className="btn secondary" onClick={onClose}>Cancel</button>
      <button className="btn" disabled={!valid || busy} onClick={go}>{busy ? "Saving…" : "Apply scholarship"}</button>
    </>}>
      <div className="field"><label htmlFor="sa">Amount (₹)</label>
        <input id="sa" className="input" type="number" min="1" step="1" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      <div className="field"><label htmlFor="sr">Reason</label>
        <textarea id="sr" className="input" maxLength={200} placeholder="e.g. Merit scholarship, state award" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      {err && <p className="helper-err" role="alert">{err}</p>}
    </Modal>
  );
}

function LinkDialog({ st, due, onClose, onDone }) {
  const [amount, setAmount] = useState(String(due / 100));
  const [res, setRes] = useState(null);
  const [lang, setLang] = useState("en");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const n = Number(amount);
  const valid = Number.isInteger(n) && n >= 1 && n * 100 <= due;
  async function go() {
    setBusy(true); setErr("");
    try { setRes(await api(`/fees/student/${st.id}/links`, { method: "POST", body: { amountRupees: n } })); onDone(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <Modal title="Payment link" sub="Test mode: nothing real is charged." icon={Link2} onClose={onClose}
      footer={res ? <button className="btn" onClick={onClose}>Done</button> : <>
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" disabled={!valid || busy} onClick={go}>{busy ? "Creating…" : "Create link"}</button></>}>
      {!res ? (
        <div className="field"><label htmlFor="la">Amount (₹)</label>
          <input id="la" className="input" type="number" min="1" step="1" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>A new link cancels any earlier open link. It expires in 7 days.</p></div>
      ) : (
        <>
          <div className="field"><label>Link for {rupees(res.link.amountPaise)}</label>
            <input className="input mono" readOnly value={res.link.url} onFocus={(e) => e.target.select()} /></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <CopyBtn text={res.link.url} label="Copy link" />
            <a className="btn secondary" href={res.link.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open as parent</a>
          </div>
          <div className="seg" style={{ margin: 0 }} role="tablist">
            {[["en", "English"], ["od", "Odia"]].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={lang === k} className={lang === k ? "on" : ""} onClick={() => setLang(k)}>{l}</button>))}
          </div>
          <div className="sms">{res.message[lang]}</div>
          <p className="muted" style={{ fontSize: 12 }}>Messages are mocked in this build. Copy the text to send it.</p>
        </>
      )}
      {err && <p className="helper-err" role="alert">{err}</p>}
    </Modal>
  );
}

function StudentLedger({ id, onClose }) {
  const { data, error, loading, reload } = useApi(`/fees/student/${id}`, ["fees"]);
  const [dialog, setDialog] = useState(null);
  const [note, setNote] = useState(null);
  const d = data;
  const st = d?.student;
  return (
    <Modal side flush icon={Wallet} title={st?.name ?? "Student"} sub={st ? `${st.rollNo} · ${st.programme} · ${st.category}` : "Loading…"} onClose={onClose}>
      {error ? <ErrorState error={error} onRetry={reload} />
        : loading && !d ? <div style={{ padding: 20 }}><Skeleton rows={6} /></div>
        : (
          <div className="ledger-body">
            {note && <div className="notice" role="status" style={{ margin: 0 }}><Check size={16} /> {note.text}
              {note.entryId && <Link to={`/receipt/${note.entryId}`} style={{ marginLeft: "auto" }}>View receipt</Link>}</div>}
            <dl className="facts">
              <div><dt>Billed</dt><dd className="tnum">{rupees(d.totals.billed)}</dd></div>
              <div><dt>Scholarship</dt><dd className="tnum">{rupees(d.totals.scholarship)}</dd></div>
              <div><dt>Paid</dt><dd className="tnum">{rupees(d.totals.paid)}</dd></div>
              <div className={d.totals.due > 0 ? "due" : ""}><dt>Due</dt><dd className="tnum">{rupees(Math.max(d.totals.due, 0))}</dd></div>
            </dl>
            {st.isMinor && !st.guardianConsent && <div className="callout"><Check size={16} /><span>Guardian consent is pending (DPDP). Messages to this guardian are held.</span></div>}
            <div className="actions" style={{ justifyContent: "flex-start" }}>
              <button className="btn" disabled={d.totals.due <= 0} onClick={() => setDialog("pay")}><Plus size={15} /> Record payment</button>
              <button className="btn secondary" disabled={d.totals.due <= 0} onClick={() => setDialog("link")}><Link2 size={15} /> Payment link</button>
              <button className="btn secondary" disabled={d.totals.due <= 0} onClick={() => setDialog("sch")}><Award size={15} /> Scholarship</button>
            </div>
            {d.openLink && (
              <div className="linkcard"><div><b>Open payment link · {rupees(d.openLink.amountPaise)}</b>
                <span className="muted">Expires {dateIN(d.openLink.expiresAt)}</span></div>
                <CopyBtn text={d.openLink.url} /></div>
            )}
            <h3 className="label" style={{ marginTop: 8 }}>Ledger</h3>
            <ul className="lg">
              {d.entries.map((e) => (
                <li key={e.id}>
                  <div className="lg-top">
                    <span className={`badge ${TYPE[e.type][1]}`}>{TYPE[e.type][0]}</span>
                    <b className={`tnum ${e.type === "CHARGE" ? "" : "teal"}`}>{e.type === "CHARGE" ? "+" : "−"}{rupees(e.amountPaise)}</b>
                  </div>
                  <div className="lg-sub muted">
                    {e.note}{e.method ? ` · ${e.method}` : ""}{e.reference ? ` · ${e.reference}` : ""} · {dateIN(e.at)}
                    {e.dueDate ? ` · due ${dateIN(e.dueDate)}` : ""}
                    {e.receiptNo && <> · <Link to={`/receipt/${e.id}`}>{e.receiptNo}</Link></>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      {dialog === "pay" && <PayDialog st={st} due={d.totals.due} onClose={() => setDialog(null)} onDone={(text, entryId) => setNote({ text, entryId })} />}
      {dialog === "sch" && <ScholarshipDialog st={st} due={d.totals.due} onClose={() => setDialog(null)} onDone={(text) => setNote({ text })} />}
      {dialog === "link" && <LinkDialog st={st} due={d.totals.due} onClose={() => setDialog(null)} onDone={reload} />}
    </Modal>
  );
}

function GenerateDialog({ onClose, onDone }) {
  const programmes = useApi("/masters/programmes");
  const [batchId, setBatchId] = useState("");
  const [term, setTerm] = useState("2026-27");
  const [dueDate, setDueDate] = useState("2026-12-15");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const batches = (programmes.data?.items ?? []).flatMap((p) => p.batches.map((b) => ({ id: b.id, label: `${p.code} · ${b.label}` })));
  async function go() {
    setBusy(true); setErr("");
    try {
      const r = await api("/fees/generate", { method: "POST", body: { batchId, term, dueDate } });
      onDone(`Dues generated: ${r.created} new, ${r.skipped} already existed${r.missing ? `, ${r.missing} skipped (no fee structure)` : ""}.`);
      onClose();
    } catch (e) { setErr(e.message); setBusy(false); }
  }
  return (
    <Modal title="Generate dues" sub="Creates one tuition charge per student from the fee structure. Running it again changes nothing." icon={Plus} onClose={onClose} footer={<>
      <button className="btn secondary" onClick={onClose}>Cancel</button>
      <button className="btn" disabled={!batchId || !/^\d{4}-\d{2}$/.test(term) || !dueDate || busy} onClick={go}>{busy ? "Generating…" : "Generate"}</button>
    </>}>
      <div className="field"><label>Batch</label>
        <select className="select" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
          <option value="">Select…</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select></div>
      <div className="field"><label>Term</label>
        <input className="input" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="2026-27" /></div>
      <div className="field"><label>Due date</label>
        <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
      {err && <p className="helper-err" role="alert">{err}</p>}
    </Modal>
  );
}

function Dues({ onNote }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [programmeId, setProgrammeId] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const q = useDebounced(search.trim(), 300);
  const programmes = useApi("/masters/programmes", ["masters"]);
  const path = `/fees/dues?status=${status}&page=${page}&pageSize=25${q ? `&search=${encodeURIComponent(q)}` : ""}${programmeId ? `&programmeId=${programmeId}` : ""}`;
  const { data, error, loading, reload } = useApi(path, ["fees", "masters"]);
  const s = data?.summary;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const net = s ? s.billed - s.scholarship : 0;

  return (
    <>
      {s && (
        <div className="kpis">
          <Kpi label="Total billed" value={rupees(s.billed)} note={`Scholarships ${rupees(s.scholarship)}`} />
          <Kpi label="Collected" value={rupees(s.paid)} note={net ? `${Math.round((s.paid / net) * 100)}% of payable` : "—"} />
          <Kpi label="Outstanding" value={rupees(s.outstanding)} note={`${s.owingCount} students`} />
          <Kpi label="Critical, over 60 days" value={rupees(s.criticalAmount)} tone={s.criticalCount ? "risk" : undefined} note={`${s.criticalCount} students`} />
        </div>
      )}
      <div className="controls">
        <div className="search"><Search size={16} />
          <input className="input" placeholder="Search by name or roll number" aria-label="Search students" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
        <select className="select" style={{ width: 170 }} aria-label="Programme" value={programmeId} onChange={(e) => { setProgrammeId(e.target.value); setPage(1); }}>
          <option value="">All programmes</option>
          {programmes.data?.items.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}</select>
        <div className="seg" style={{ margin: 0 }} role="tablist">
          {[["all", "All"], ["due", "With dues"], ["critical", "Critical"], ["cleared", "Cleared"]].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={status === k} className={status === k ? "on" : ""} onClick={() => { setStatus(k); setPage(1); }}>{l}</button>))}
        </div>
      </div>
      <Panel>
        {error ? <ErrorState error={error} onRetry={reload} />
          : loading && !data ? <Skeleton />
          : !data.items.length ? <Empty title="No students match" hint="Clear the search or change the filter." />
          : (
            <>
              <div className="table-wrap"><table>
                <thead><tr><th>Roll no</th><th>Student</th><th className="num">Billed</th><th className="num">Paid</th><th className="num">Due</th><th>Aging</th><th>Status</th></tr></thead>
                <tbody>{data.items.map((r) => (
                  <tr key={r.studentId} className="click" tabIndex={0} onClick={() => setOpen(r.studentId)}
                    onKeyDown={(e) => e.key === "Enter" && setOpen(r.studentId)}>
                    <td className="mono">{r.rollNo}</td>
                    <td><b style={{ fontWeight: 500 }}>{r.name}</b> <span className="muted" style={{ marginLeft: 6 }}>{r.programme} · {r.category}</span></td>
                    <td className="num">{rupees(r.billed)}</td>
                    <td className="num">{rupees(r.paid)}</td>
                    <td className={`num ${r.due > 0 ? "redtxt" : ""}`}>{rupees(Math.max(r.due, 0))}</td>
                    <td className={r.overdueDays > 0 ? "redtxt" : "muted"}>{aging(r)}</td>
                    <td><FeeBadge s={r.status} /></td>
                  </tr>))}</tbody>
              </table></div>
              <div className="panel-foot">
                <span className="tnum">Showing {(page - 1) * data.pageSize + 1}–{Math.min(page * data.pageSize, data.total)} of {data.total} students</span>
                <div className="pager">
                  <button className="btn secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                  <button className="btn secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
              </div>
            </>
          )}
      </Panel>
      {open && <StudentLedger id={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function Structure() {
  const { data, error, loading, reload } = useApi("/fees/structures", ["fees"]);
  const [year, setYear] = useState(3);
  return (
    <>
      <div className="seg" role="tablist">
        {[1, 2, 3, 4].map((y) => <button key={y} role="tab" aria-selected={year === y} className={year === y ? "on" : ""} onClick={() => setYear(y)}>Year {y}</button>)}
      </div>
      <Panel title="Annual fee by programme and category" meta={<span className="muted" style={{ fontSize: 12 }}>Used when dues are generated</span>}>
        {error ? <ErrorState error={error} onRetry={reload} />
          : loading && !data ? <Skeleton rows={5} />
          : (
            <div className="table-wrap"><table>
              <thead><tr><th>Programme</th><th>Category</th><th className="num">Annual fee</th></tr></thead>
              <tbody>{data.items.filter((i) => i.yearNo === year).map((i) => (
                <tr key={i.id}><td>{i.programme.code} · {i.programme.name}</td><td>{i.category}</td><td className="num">{rupees(i.amountPaise)}</td></tr>))}</tbody>
            </table></div>
          )}
      </Panel>
    </>
  );
}

export default function Fees() {
  const [tab, setTab] = useState("dues");
  const [dialog, setDialog] = useState(false);
  const [note, setNote] = useState(null);
  const thisMonth = new Date().toLocaleDateString("en-CA").slice(0, 7);
  return (
    <div className="page">
      <PageHeader eyebrow="Accounts" title="Fee dues and ledger" sub="One append-only ledger per student. Dues are always worked out, never stored."
        action={<div className="actions">
          <a className="btn secondary" href={`/api/fees/export/tally.csv?month=${thisMonth}`}><Download size={15} /> Export receipts (CSV)</a>
          <button className="btn" onClick={() => setDialog(true)}><Plus size={15} /> Generate dues</button>
        </div>} />
      {note && <div className="notice" role="status"><Check size={16} /> {note}</div>}
      <div className="seg" role="tablist">
        {[["dues", "Dues"], ["structure", "Fee structure"]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>))}
      </div>
      {tab === "dues" ? <Dues /> : <Structure />}
      {dialog && <GenerateDialog onClose={() => setDialog(false)} onDone={setNote} />}
    </div>
  );
}