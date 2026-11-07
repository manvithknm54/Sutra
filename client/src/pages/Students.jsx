import { useEffect, useRef, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth.jsx";
import { useApi, useDebounced, useFlash } from "../hooks.js";
import { Empty, ErrorState, Flash, Modal, PageHeader, Panel, Skeleton } from "../components/ui.jsx";

function ConsentDialog({ s, mode, onClose, onDone }) {
  const give = mode === "give";
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("Father");
  const [note, setNote] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const valid = give ? name.trim().length >= 2 && agree : note.trim().length >= 5;
  async function go() {
    setBusy(true); setErr("");
    try {
      await api(`/students/${s.id}/consent`, { method: "POST",
        body: give ? { action: "give", guardianName: name.trim(), relation, note: note.trim() || undefined } : { action: "withdraw", note: note.trim() } });
      onDone(give ? `Consent recorded for ${s.name}. Held messages are being released.` : `Consent withdrawn for ${s.name}. Messages are on hold again.`);
      onClose();
    } catch (e) { setErr(e.message); setBusy(false); }
  }
  return (
    <Modal title={give ? "Record guardian consent" : "Withdraw consent"} icon={ShieldCheck} tone={give ? "" : "risk"}
      sub={give ? `${s.name} is a minor. Messages to the guardian stay on hold until consent is recorded.` : `${s.name}. Messages to the guardian will be held again.`}
      onClose={onClose} footer={<>
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className={`btn ${give ? "" : "danger"}`} disabled={!valid || busy} onClick={go}>{busy ? "Saving…" : give ? "Record consent" : "Withdraw consent"}</button>
      </>}>
      {give ? (
        <>
          <div className="field"><label htmlFor="gn">Guardian's name</label>
            <input id="gn" className="input" autoFocus maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label htmlFor="gr">Relation</label>
            <select id="gr" className="select" value={relation} onChange={(e) => setRelation(e.target.value)}>
              {["Father", "Mother", "Legal guardian"].map((r) => <option key={r}>{r}</option>)}</select></div>
          <label className="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>The guardian has consented to the college processing this student's data and contacting them (DPDP Act 2023).</span></label>
        </>
      ) : (
        <div className="field"><label htmlFor="wn">Reason for withdrawal</label>
          <textarea id="wn" className="input" autoFocus maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      )}
      {err && <p className="helper-err" role="alert">{err}</p>}
    </Modal>
  );
}

export default function Students() {
  const { user } = useAuth();
  const admin = user.role === "ADMIN";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [consent, setConsent] = useState(null);
  const [note, setNote, clearNote] = useFlash();
  const inputRef = useRef(null);
  const q = useDebounced(search.trim(), 300);
  const path = `/students?page=${page}&pageSize=25${q ? `&search=${encodeURIComponent(q)}` : ""}`;
  const { data, error, loading, reload } = useApi(path, ["masters"]);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="page">
      <PageHeader eyebrow="Records" title="Students" sub="Guardian numbers are masked in lists." />
      <Flash note={note} onClose={clearNote} />
      <div className="controls">
        <div className="search">
          <Search size={16} />
          <input ref={inputRef} className="input" placeholder="Search by name or roll number" aria-label="Search students"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <span className="kbd">/</span>
        </div>
      </div>
      <Panel>
        {error ? <ErrorState error={error} onRetry={reload} />
          : loading && !data ? <Skeleton />
          : !data.items.length ? <Empty title="No students found" hint={q ? "Try a different name or roll number." : "No students in your classes yet."} />
          : (
            <>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Roll no</th><th>Name</th><th>Programme</th><th>Category</th><th>Guardian</th><th>Consent</th></tr></thead>
                  <tbody>
                    {data.items.map((s) => (
                      <tr key={s.id}>
                        <td className="mono">{s.rollNo}</td>
                        <td style={{ fontWeight: 500 }}>{s.name}</td>
                        <td>{s.batch.programme.code} · {s.batch.label}</td>
                        <td>{s.category}</td>
                        <td className="mono">{s.guardianPhone ?? "—"}</td>
                        <td>
                          {!s.isMinor ? <span className="muted">—</span> : (
                            <span className="consent-cell">
                              {s.guardianConsent
                                ? <><span className="badge ok"><span className="dot" />Minor · consent on file</span>
                                    {admin && <button className="linkbtn" onClick={() => setConsent({ s, mode: "withdraw" })}>Withdraw</button>}</>
                                : <><span className="badge risk"><span className="dot" />Minor · consent pending</span>
                                    {admin && <button className="btn secondary sm" onClick={() => setConsent({ s, mode: "give" })}>Record consent</button>}</>}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="panel-foot">
                <span className="tnum">Showing {(page - 1) * data.pageSize + 1}–{Math.min(page * data.pageSize, data.total)} of {data.total} records</span>
                <div className="pager">
                  <button className="btn secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                  <button className="btn secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
              </div>
            </>
          )}
      </Panel>
      {consent && <ConsentDialog {...consent} onClose={() => setConsent(null)} onDone={(t) => { setNote(t); reload(); }} />}
    </div>
  );
}