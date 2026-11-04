import { AlertCircle, Inbox } from "lucide-react";

export const PageHeader = ({ title, sub, action }) => (
  <div className="page-head">
    <div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
    {action}
  </div>
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
    {onRetry && <button className="btn ghost" onClick={onRetry}>Try again</button>}
  </div>
);