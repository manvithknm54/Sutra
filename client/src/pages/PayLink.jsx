import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { api } from "../api";
import { rupees } from "../utils.js";
import Logo from "../components/Logo.jsx";

export default function PayLink() {
  const { token } = useParams();
  const [s, setS] = useState({ loading: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api(`/public/pay/${token}`).then((d) => setS({ d })).catch((e) => setS({ error: e }));
  }, [token]);

  async function pay() {
    setBusy(true); setErr("");
    try { const r = await api(`/public/pay/${token}`, { method: "POST" }); setS((x) => ({ d: { ...x.d, status: "PAID", receiptNo: r.receiptNo } })); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  const d = s.d;
  return (
    <div className="pay-wrap">
      <div className="pay-card">
        <div className="brand-row" style={{ marginBottom: 16 }}><Logo size={32} /><div><b>Sutra</b><span className="label">Fee payment</span></div></div>
        {s.loading ? <p className="muted">Loading…</p>
          : s.error ? <div className="pay-state"><XCircle size={30} style={{ color: "var(--risk)" }} /><h2>Link not found</h2><p className="muted">{s.error.message}</p></div>
          : d.status === "PAID" ? <div className="pay-state"><CheckCircle2 size={34} style={{ color: "var(--teal)" }} /><h2>Payment received</h2>
              <p className="muted">{rupees(d.amountPaise)} for {d.student.name}</p><p>Receipt <b className="mono">{d.receiptNo}</b></p></div>
          : d.status !== "OPEN" ? <div className="pay-state"><XCircle size={30} style={{ color: "var(--risk)" }} />
              <h2>{d.status === "EXPIRED" ? "This link has expired" : "This link is no longer active"}</h2><p className="muted">Please ask the college office for a new link.</p></div>
          : (
            <>
              <dl className="r-grid" style={{ gridTemplateColumns: "1fr" }}>
                <div><dt>Student</dt><dd>{d.student.name}</dd></div>
                <div><dt>Roll no</dt><dd className="mono">{d.student.rollNo}</dd></div>
                <div><dt>Programme</dt><dd>{d.student.programme} · {d.student.batch}</dd></div>
              </dl>
              <div className="r-amount"><span className="label">Amount to pay</span><b className="tnum">{rupees(d.amountPaise)}</b></div>
              {err && <p className="helper-err" role="alert">{err}</p>}
              <button className="btn" style={{ width: "100%", height: 46 }} disabled={busy} onClick={pay}>{busy ? "Processing…" : `Pay ${rupees(d.amountPaise)}`}</button>
              <p className="muted" style={{ fontSize: 12, textAlign: "center" }}>Questions? Contact the college accounts office.</p>
            </>
          )}
      </div>
    </div>
  );
}