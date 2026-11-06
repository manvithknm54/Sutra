import { useEffect } from "react";
import { AlertCircle, Check, Inbox, Lock, X } from "lucide-react";

export const PageHeader = ({ title, sub, action, eyebrow }) => (
  <div className="page-head">
    <div>
      {eyebrow && <p className="label eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {sub && <p className="sub">{sub}</p>}
    </div>
    {action}
  </div>
);

export const Kpi = ({ label, value, note, tone }) => (
  <div className="kpi">
    <p className="label">{label}</p>
    <p className={`k-value ${tone === "risk" ? "risk" : ""}`}>{value}</p>
    {note && <p className="k-note">{note}</p>}
  </div>
);

export const Panel = ({ title, meta, children }) => (
  <section className="panel">
    {title && <div className="panel-head"><h2>{title}</h2>{meta}</div>}
    {children}
  </section>
);

export const Skeleton = ({ rows = 6 }) => (
  <div className="skeleton-list" aria-busy="true" aria-label="Loading">
    {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton" />)}
  </div>
);

export const Empty = ({ title, hint }) => (
  <div className="state">
    <Inbox size={22} className="muted" />
    <h2>{title}</h2>
    {hint && <p>{hint}</p>}
  </div>
);

export const ErrorState = ({ error, onRetry }) => (
  <div className="state err" role="alert">
    <AlertCircle size={22} />
    <h2>Couldn't load this</h2>
    <p>{error?.message || "Something went wrong."}</p>
    {onRetry && <button className="btn secondary" onClick={onRetry}>Try again</button>}
  </div>
);

const STATUS = { DRAFT: ["Draft", ""], SUBMITTED: ["Submitted", ""], MODERATED: ["Moderated", "ok"], LOCKED: ["Locked", "ok"] };
export const StatusBadge = ({ status }) => {
  const [label, tone] = STATUS[status];
  return <span className={`badge ${tone}`}>{status === "LOCKED" ? <Lock size={12} /> : <span className="dot" />}{label}</span>;
};

const ORDER = ["DRAFT", "SUBMITTED", "MODERATED", "LOCKED"];
const STEPS = [["Draft entry", "Faculty enters marks"], ["Submitted", "Awaiting moderation"], ["Moderated", "Ready to lock"], ["Locked", "Read-only and audited"]];
export const Stepper = ({ status }) => {
  const cur = ORDER.indexOf(status);
  return (
    <ol className="stepper" aria-label="Marks workflow">
      {STEPS.map(([t, c], i) => (
        <li key={t} className={i < cur ? "done" : i === cur ? "current" : "todo"} aria-current={i === cur ? "step" : undefined}>
          <span className="no">{i < cur || (status === "LOCKED" && i === cur) ? <Check size={13} /> : i + 1}</span>
          <span><b>{t}</b><span className="cap">{c}</span></span>
        </li>
      ))}
    </ol>
  );
};

export function Modal({ title, onClose, children, footer, side, flush }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className={`overlay ${side ? "side" : ""}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h2>{title}</h2><button className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button></div>
        <div className={flush ? "" : "modal-body"}>{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}