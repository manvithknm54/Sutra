import { useState } from "react";
import { Modal } from "./ui.jsx";

// A dialog with one text box. Used for dismissing a flag, closing a task and similar.
export function ReasonDialog({ title, body, confirm, label, optional, min = 5, icon, danger, onConfirm, onClose }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ok = optional || text.trim().length >= min;
  async function go() {
    setBusy(true); setErr("");
    try { await onConfirm(text.trim()); onClose(); } catch (e) { setErr(e.message); setBusy(false); }
  }
  return (
    <Modal title={title} sub={body} icon={icon} tone={danger ? "risk" : ""} onClose={onClose} footer={<>
      <button className="btn secondary" onClick={onClose}>Cancel</button>
      <button className={`btn ${danger ? "danger" : ""}`} disabled={!ok || busy} onClick={go}>{busy ? "Working…" : confirm}</button>
    </>}>
      <div className="field"><label htmlFor="rd">{label}</label>
        <textarea id="rd" className="input" autoFocus maxLength={300} value={text} onChange={(e) => setText(e.target.value)} /></div>
      {err && <p className="helper-err" role="alert">{err}</p>}
    </Modal>
  );
}