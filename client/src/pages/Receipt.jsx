import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { useApi } from "../hooks.js";
import { rupees, timeIN } from "../utils.js";
import { ErrorState, Skeleton } from "../components/ui.jsx";

export default function Receipt() {
  const { id } = useParams();
  const { data: r, error, reload } = useApi(`/fees/receipt/${id}`);
  const back = <Link to="/fees" className="back noprint"><ArrowLeft size={15} /> Back to fees</Link>;
  if (error) return <div className="page">{back}<ErrorState error={error} onRetry={reload} /></div>;
  if (!r) return <div className="page">{back}<Skeleton rows={6} /></div>;
  return (
    <div className="page">
      {back}
      <div className="receipt">
        <div className="r-head"><div><h2>{r.campus}</h2><p className="muted">Fee receipt</p></div>
          <div className="r-no"><span className="label">Receipt no</span><b className="mono">{r.receiptNo}</b></div></div>
        <dl className="r-grid">
          <div><dt>Received from</dt><dd>{r.student.name}</dd></div>
          <div><dt>Roll no</dt><dd className="mono">{r.student.rollNo}</dd></div>
          <div><dt>Programme</dt><dd>{r.student.programme} · {r.student.batch}</dd></div>
          <div><dt>Date</dt><dd>{timeIN(r.at)}</dd></div>
          <div><dt>Method</dt><dd>{r.method}{r.reference ? ` · ${r.reference}` : ""}</dd></div>
          <div><dt>Balance due now</dt><dd className="tnum">{rupees(Math.max(r.dueAfter, 0))}</dd></div>
        </dl>
        <div className="r-amount"><span className="label">Amount received</span><b className="tnum">{rupees(r.amountPaise)}</b></div>
        <p className="muted" style={{ fontSize: 12 }}>Computer-generated receipt. No signature required.</p>
      </div>
      <button className="btn noprint" onClick={() => window.print()}><Printer size={15} /> Print receipt</button>
    </div>
  );
}