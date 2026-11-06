import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCheck, Download, History, KeyRound, Lock, Search, Send, SlidersHorizontal, Undo2 } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks.js";
import { Empty, ErrorState, Kpi, Modal, PageHeader, Panel, Skeleton, Stepper, StatusBadge } from "../components/ui.jsx";

const fmt = (n) => (n == null ? "" : Number.isInteger(n) ? String(n) : n.toFixed(1));
const when = (iso) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const LABEL = {
  MARK_SET: "Mark entered", SUBMIT: "Submitted", RETURN: "Returned to faculty", MODERATE: "Moderation",
  COMPLETE_MODERATION: "Moderation completed", LOCK: "Locked", UNLOCK_REQUEST: "Unlock requested",
  UNLOCK_APPROVE: "Unlock approved", UNLOCK_REJECT: "Unlock rejected", EXPORT: "Exported",
};
const DONE = {
  SUBMIT: "Submitted for moderation.", RETURN: "Returned to the faculty.", COMPLETE_MODERATION: "Moderation completed.",
  LOCK: "Marks locked. They are now read-only.", UNLOCK_REQUEST: "Unlock request sent to the office admin.",
  UNLOCK_APPROVE: "Unlock approved. The sheet is back in Draft.", UNLOCK_REJECT: "Unlock request rejected.",
};

function validateMark(text, max) {
  const s = text.trim();
  if (s === "") return { value: null, error: "" };
  const v = Number(s);
  if (!Number.isFinite(v)) return { value: null, error: "Numbers only" };
  if (v < 0 || v > max) return { value: null, error: `0 to ${max}` };
  if (Math.round(v * 2) !== v * 2) return { value: null, error: "Steps of 0.5" };
  return { value: v, error: "" };
}

function MarkCell({ cell, max, label, editable, onSave, inputRef, onEnter }) {
  const server = cell?.raw ?? null;
  const [text, setText] = useState(server == null ? "" : String(server));
  const [saveErr, setSaveErr] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setText(server == null ? "" : String(server)); setSaveErr(""); }, [server]);

  // Validated live from the text, so the message can never get stuck.
  const { value, error: liveErr } = validateMark(text, max);
  const err = liveErr || saveErr;

  async function commit() {
    if (liveErr) return false;                              // keep the message until it's fixed
    if (value === server) { setSaveErr(""); return true; }  // nothing changed, nothing to save
    setSaving(true);
    try { await onSave(value); setSaveErr(""); return true; }
    catch (e) { setSaveErr(e.message); return false; }
    finally { setSaving(false); }
  }

  if (!editable)
    return (
      <span className="tnum">
        {server == null ? <span className="muted">—</span> : fmt(server)}
        {cell?.delta ? <small className="dlt" title={cell.reason || "Moderation"}>{cell.delta > 0 ? "+" : ""}{fmt(cell.delta)}</small> : null}
      </span>
    );
  return (
    <span className="mwrap">
      <input ref={inputRef} className={`mcell ${err ? "err" : ""}`} inputMode="decimal" value={text} readOnly={saving}
        aria-label={label} aria-invalid={!!err}
        onChange={(e) => { setText(e.target.value); setSaveErr(""); }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit().then((ok) => ok && onEnter?.()); // only move down when the value is valid
          }
        }} />
      {err && <span className="merr" role="alert">{err}</span>}
    </span>
  );
}

function ActionDialog({ title, body, confirm, reasonLabel, facts, note, icon, danger, onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ok = !reasonLabel || reason.trim().length >= 5;
  async function go() {
    setBusy(true); setErr("");
    try { await onConfirm(reason.trim() || undefined); onClose(); } catch (e) { setErr(e.message); setBusy(false); }
  }
  return (
    <Modal title={title} sub={body} icon={icon} tone={danger ? "risk" : ""} onClose={onClose} footer={<>
      <button className="btn secondary" onClick={onClose}>Cancel</button>
      <button className={`btn ${danger ? "danger" : ""}`} disabled={!ok || busy} onClick={go}>{busy ? "Working…" : confirm}</button>
    </>}>
      {facts && <dl className="facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="tnum">{v}</dd></div>)}</dl>}
      {note && <div className="callout"><AlertCircle size={16} /><span>{note}</span></div>}
      {reasonLabel && (
        <div className="field"><label htmlFor="why">{reasonLabel}</label>
          <textarea id="why" className="input" autoFocus maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      )}
      {err && <p className="helper-err" role="alert">{err}</p>}
    </Modal>
  );
}

function ModerateDialog({ sheet, id, onClose, onDone }) {
  const [scope, setScope] = useState("all");
  const [studentId, setStudentId] = useState("");
  const [componentId, setComponentId] = useState(sheet.components[0].id);
  const [delta, setDelta] = useState("1");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const dv = Number(delta);
  const valid = delta !== "" && Number.isFinite(dv) && Math.round(dv * 2) === dv * 2 && Math.abs(dv) <= 10
    && reason.trim().length >= 5 && (scope === "all" || studentId);

  async function go() {
    setBusy(true); setErr("");
    try {
      const r = await api(`/marks/${id}/moderate`, { method: "POST", body: { componentId, studentId: scope === "all" ? null : studentId, delta: dv, reason: reason.trim() } });
      onDone(r.changed ? `Moderation applied to ${r.changed} ${r.changed === 1 ? "entry" : "entries"}${r.capped ? ` (${r.capped} held at the component limit)` : ""}.` : "Nothing changed. Those marks already carry this adjustment.");
    } catch (e) { setErr(e.message); setBusy(false); }
  }
  return (
    <Modal title="Add moderation" icon={SlidersHorizontal} sub="Added on top of the raw mark and recorded with your reason. Raw marks are never overwritten." onClose={onClose} footer={<>
      <button className="btn secondary" onClick={onClose}>Cancel</button>
      <button className="btn" disabled={!valid || busy} onClick={go}>{busy ? "Applying…" : "Apply"}</button>
    </>}>
      <div className="field"><label>Apply to</label>
        <select className="select" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="all">Whole class</option><option value="one">One student</option>
        </select></div>
      {scope === "one" && (
        <div className="field"><label>Student</label>
          <select className="select" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Select…</option>
            {sheet.rows.map((r) => <option key={r.studentId} value={r.studentId}>{r.rollNo} · {r.name}</option>)}
          </select></div>
      )}
      <div className="field"><label>Component</label>
        <select className="select" value={componentId} onChange={(e) => setComponentId(e.target.value)}>
          {sheet.components.map((c) => <option key={c.id} value={c.id}>{c.name} (out of {c.maxMarks})</option>)}
        </select></div>
      <div className="field"><label>Adjustment (±, steps of 0.5)</label>
        <input className="input" type="number" step="0.5" min="-10" max="10" value={delta} onChange={(e) => setDelta(e.target.value)} />
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Never takes a mark above its maximum or below zero. Enter 0 to clear.</p></div>
      <div className="field"><label htmlFor="mreason">Reason</label>
        <textarea id="mreason" className="input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Test 2 paper ran long" /></div>
      {err && <p className="helper-err" role="alert">{err}</p>}
    </Modal>
  );
}

function AuditDrawer({ id, onClose }) {
  const { data, error, loading, reload } = useApi(`/marks/${id}/audit`);
  return (
    <Modal side flush title="Audit log" onClose={onClose}>
      {error ? <ErrorState error={error} onRetry={reload} />
        : loading && !data ? <Skeleton rows={6} />
        : !data.items.length ? <Empty title="No changes yet" />
        : (
          <ul className="audit">
            {data.items.map((it) => (
              <li key={it.id}>
                <div className="a-top"><b>{LABEL[it.action] ?? it.action}</b><span className="muted tnum">{when(it.at)}</span></div>
                <div className="a-line">
                  {it.student && <span className="mono">{it.student.rollNo}</span>}
                  {it.component && <span>{it.component}</span>}
                  {(it.oldValue != null || it.newValue != null) && <span className="tnum">{it.oldValue ?? "—"} → {it.newValue ?? "—"}</span>}
                </div>
                {it.reason && <div className="a-reason">“{it.reason}”</div>}
                <div className="muted" style={{ fontSize: 12 }}>by {it.actor.name}</div>
              </li>
            ))}
          </ul>
        )}
    </Modal>
  );
}

export default function MarkSheet() {
  const { allocationId: id } = useParams();
  const sheet = useApi(`/marks/${id}`);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [dialog, setDialog] = useState(null);
  const [note, setNote] = useState(null);
  const refs = useRef({});
  const d = sheet.data;

  const rows = useMemo(() => {
    if (!d) return [];
    const n = q.trim().toLowerCase();
    return d.rows.map((r, i) => ({ ...r, n: i + 1 })).filter((r) =>
      (!n || r.name.toLowerCase().includes(n) || r.rollNo.toLowerCase().includes(n)) &&
      (filter === "all" || (filter === "moderated" && r.delta !== 0) || (filter === "missing" && r.missing > 0)));
  }, [d, q, filter]);

  async function run(action, reason) {
    await api(`/marks/${id}/action`, { method: "POST", body: { action, reason } });
    setNote({ ok: true, text: DONE[action] });
    sheet.reload();
  }
  async function exportCsv() {
    try {
      const res = await fetch(`/api/marks/${id}/export.csv`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Export failed");
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || "internal-marks.csv";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
      setNote({ ok: true, text: "CSV downloaded. This export is recorded in the audit log." });
    } catch (e) { setNote({ ok: false, text: e.message }); }
  }
  async function saveCell(studentId, componentId, marks) {
    await api(`/marks/${id}/entries`, { method: "PUT", body: { entries: [{ studentId, componentId, marks }] } });
    sheet.reload();
  }

  const back = <Link to="/marks" className="back"><ArrowLeft size={15} /> All mark sheets</Link>;
  if (sheet.error) return <div className="page">{back}<Panel><ErrorState error={sheet.error} onRetry={sheet.reload} /></Panel></div>;
  if (!d) return <div className="page">{back}<Skeleton rows={8} /></div>;

  const { perms, stats, allocation: al, components, status } = d;
  const missingTotal = stats.expected - stats.filled;
  const open = (type, extra) => setDialog({ type, ...extra });
  const act = (cfg) => open("action", cfg);

  return (
    <div className="page">
      {back}
      <PageHeader
        eyebrow={`${al.batch.programme} · Semester ${al.subject.semester} · Batch ${al.batch.label}`}
        title={<>Internal marks · {al.subject.code} <StatusBadge status={status} /></>}
        sub={`${al.subject.name} · Faculty: ${al.faculty} · Out of ${d.maxTotal}`}
        action={
          <div className="actions">
            <button className="btn secondary" onClick={() => open("audit")}><History size={15} /> Audit log</button>
            {perms.canExport && <button className="btn" onClick={exportCsv}><Download size={15} /> Export CSV</button>}
            {perms.canSubmit && (
              <button className="btn" disabled={missingTotal > 0} title={missingTotal ? `${missingTotal} marks missing` : undefined}
                onClick={() => act({
                  action: "SUBMIT", icon: Send, title: "Submit for moderation", confirm: "Submit marks",
                  body: "Your marks go to the office admin for moderation.",
                  facts: [["Students", d.rows.length], ["Components", components.length], ["Marks entered", stats.filled]],
                  note: "After you submit, you can't edit these marks. If something is wrong, the admin can return the sheet to you.",
                })}>Submit for moderation</button>
            )}
            {perms.canReturn && (
              <button className="btn secondary" onClick={() => act({
                action: "RETURN", icon: Undo2, title: "Return to faculty", confirm: "Return sheet",
                body: "The sheet goes back to Draft so the faculty can correct it.", reasonLabel: "Reason for returning",
              })}>Return to faculty</button>
            )}
            {perms.canModerate && <button className="btn secondary" onClick={() => open("moderate")}>Add moderation</button>}
            {perms.canCompleteModeration && (
              <button className="btn" onClick={() => act({
                action: "COMPLETE_MODERATION", icon: CheckCheck, title: "Complete moderation", confirm: "Complete moderation",
                body: "Moderation is finished and the sheet is ready to lock.",
                facts: [["Moderated students", stats.moderatedCount], ["Marks", stats.filled]],
              })}>Complete moderation</button>
            )}
            {perms.canLock && (
              <button className="btn" onClick={() => act({
                action: "LOCK", icon: Lock, title: "Lock marks", confirm: "Lock marks",
                body: "Locking makes the marks read-only for everyone.",
                facts: [["Marks", stats.filled], ["Moderated students", stats.moderatedCount]],
                note: "After this, any change needs an unlock request that the office admin approves. Every change is logged.",
              })}><Lock size={14} /> Lock marks</button>
            )}
            {perms.canRequestUnlock && (
              <button className="btn secondary" onClick={() => act({
                action: "UNLOCK_REQUEST", icon: KeyRound, title: "Request unlock", confirm: "Send request",
                body: "The office admin will review your request. The marks stay locked until it is approved.", reasonLabel: "What needs correcting?",
              })}>Request unlock</button>
            )}
            {perms.canResolveUnlock && <>
              <button className="btn secondary" onClick={() => act({
                action: "UNLOCK_REJECT", icon: KeyRound, danger: true, title: "Reject unlock request", confirm: "Reject request",
                body: "The marks stay locked.", reasonLabel: "Reason for rejecting",
              })}>Reject unlock</button>
              <button className="btn" onClick={() => act({
                action: "UNLOCK_APPROVE", icon: KeyRound, title: "Approve unlock", confirm: "Approve unlock",
                body: "The sheet returns to Draft so the faculty can correct it.",
                note: "It must be submitted, moderated and locked again before it can be exported.", reasonLabel: "Note for the record",
              })}>Approve unlock</button>
            </>}
          </div>
        }
      />

      {note && <div className={`notice ${note.ok ? "" : "err"}`} role="status">{note.text}</div>}
      <Stepper status={status} />
      {status === "LOCKED" && (
        <div className="lockbar"><Lock size={15} />
          <span>Locked {d.lockedAt ? `on ${when(d.lockedAt)}` : ""}. Raw marks and moderation are read-only. Changes need an approved unlock request.
            {d.unlock.pending && <b> Unlock requested: “{d.unlock.reason}”</b>}</span>
        </div>
      )}

      <div className="kpis">
        <Kpi label="Class average" value={stats.average == null ? "—" : `${stats.average}`} note={`out of ${d.maxTotal}`} />
        <Kpi label="Highest" value={stats.top ? fmt(stats.top.total) : "—"} note={stats.top?.name ?? "No complete sheets yet"} />
        <Kpi label="Moderation" value={stats.moderatedCount} note={stats.moderatedCount ? `${stats.avgDelta > 0 ? "+" : ""}${stats.avgDelta} average adjustment` : "No adjustments"} />
        <Kpi label="Entered" value={`${stats.filled}/${stats.expected}`} note={missingTotal ? `${missingTotal} missing` : "All marks entered"} tone={missingTotal ? "risk" : undefined} />
      </div>

      <div className="controls">
        <div className="search"><Search size={16} />
          <input className="input" placeholder="Find by name or roll number" aria-label="Find student" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="seg" style={{ margin: 0 }} role="tablist">
          {[["all", `All (${d.rows.length})`], ["moderated", `Moderated (${stats.moderatedCount})`], ["missing", `Missing (${d.rows.filter((r) => r.missing).length})`]].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>

      <Panel>
        {!rows.length ? <Empty title="No students match" hint="Clear the search or switch the filter." /> : (
          <div className="table-wrap">
            <table className="marks">
              <thead><tr>
                <th className="hm">#</th><th className="hm">Roll no</th><th className="stick">Student</th>
                {components.map((c) => <th key={c.id} className="num">{c.name}<small>/{c.maxMarks}</small></th>)}
                <th className="num">Raw<small>/{d.maxTotal}</small></th><th className="num">Moderation</th><th className="num final">Final<small>/{d.maxTotal}</small></th>
              </tr></thead>
              <tbody>
                {rows.map((r, ri) => (
                  <tr key={r.studentId} className={r.missing ? "warn" : ""}>
                    <td className="hm muted tnum">{String(r.n).padStart(2, "0")}</td>
                    <td className="hm mono">{r.rollNo}</td>
                    <td className="stick" style={{ fontWeight: 500 }}>{r.name}</td>
                    {components.map((c, ci) => (
                      <td key={c.id} className="num">
                        <MarkCell cell={r.marks[c.id]} max={c.maxMarks} editable={perms.canEdit} label={`${r.name}, ${c.name}`}
                          inputRef={(el) => { refs.current[`${ri}:${ci}`] = el; }}
                          onEnter={() => refs.current[`${ri + 1}:${ci}`]?.focus()}
                          onSave={(v) => saveCell(r.studentId, c.id, v)} />
                      </td>
                    ))}
                    <td className="num tnum">{r.missing ? <span className="muted">—</span> : fmt(r.rawTotal)}</td>
                    <td className="num">{r.delta ? <span className="badge ok">{r.delta > 0 ? "+" : ""}{fmt(r.delta)}</span> : <span className="muted">—</span>}</td>
                    <td className="num final tnum">{r.missing ? <span className="badge risk">{r.missing} missing</span> : <b>{fmt(r.finalTotal)}</b>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="panel-foot">
          <span className="tnum">Showing {rows.length} of {d.rows.length} students</span>
          <span>{perms.canEdit ? "Edits save as you leave a cell. Press Enter to move down." : "Read-only at this stage."}</span>
        </div>
      </Panel>

      {dialog?.type === "action" && <ActionDialog {...dialog} onClose={() => setDialog(null)} onConfirm={(reason) => run(dialog.action, reason)} />}
      {dialog?.type === "moderate" && <ModerateDialog sheet={d} id={id} onClose={() => setDialog(null)}
        onDone={(text) => { setDialog(null); setNote({ ok: true, text }); sheet.reload(); }} />}
      {dialog?.type === "audit" && <AuditDrawer id={id} onClose={() => setDialog(null)} />}
    </div>
  );
}