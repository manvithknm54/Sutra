import { AlertCircle, Inbox } from "lucide-react";

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