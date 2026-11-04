import { useState } from "react";
import { Navigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useAuth } from "../auth.jsx";
import Logo from "../components/Logo.jsx";

const DEMO = import.meta.env.VITE_DEMO === "true";
// Brief: 3 campuses (engineering, management, pharmacy). Codes are our assumption; only ENG is built.
const CAMPUSES = [["ENG", "Engineering", true], ["MGT", "Management", false], ["PHA", "Pharmacy", false]];

export default function Login() {
  const { user, ready, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (ready && user) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    try { await login(email, password); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const fill = (v) => { setEmail(v); setPassword("Sutra@2026"); setError(""); };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <section className="auth-left">
          <div style={{ display: "grid", gap: 40 }}>
            <div className="brand-row">
              <Logo size={40} />
              <div><b>Sutra</b><span className="label">Campus academic ERP</span></div>
            </div>
            <div>
              <h1>One student.<br />One record.</h1>
              <p className="lead">One thread from admission to graduation: attendance, marks and fee dues for the trust's campuses.</p>
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="label">Campuses</span>
              <span className="label" style={{ color: "var(--ink)" }}>1 of 3 live</span>
            </div>
            <div className="campuses">
              {CAMPUSES.map(([code, name, live]) => (
                <div key={code} className={`campus ${live ? "live" : ""}`}><b>{code}</b><span>{name}{live ? "" : " · planned"}</span></div>
              ))}
            </div>
          </div>
        </section>

        <section className="auth-right">
          <div className="auth-form">
            <div className="auth-m-brand brand-row"><Logo size={32} /><div><b>Sutra</b><span className="label">Campus academic ERP</span></div></div>
            <div>
              <h1>Sign in</h1>
              <p className="sub">Access classes, marks and the administrative desk.</p>
            </div>

            {error && (
              <div className="alert" role="alert">
                <AlertCircle size={18} />
                <div><b>Sign-in failed</b><span>{error}</span></div>
              </div>
            )}

            <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
              <div className="field">
                <label htmlFor="email">Email</label>
                <div className="with-icon">
                  <Mail size={17} />
                  <input id="email" className={`input ${error ? "err" : ""}`} type="email" autoComplete="username"
                    placeholder="name@campus.edu" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>
              <div className="field">
                <label htmlFor="pw">Password</label>
                <div className="with-icon">
                  <Lock size={17} />
                  <input id="pw" className={`input ${error ? "err" : ""}`} type={show ? "text" : "password"} autoComplete="current-password"
                    value={password} onChange={(e) => setPassword(e.target.value)} required />
                  <button type="button" className="icon-btn" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((s) => !s)}>
                    {show ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
              <button className="btn" disabled={busy}>{busy ? "Signing in…" : <>Sign in <ArrowRight size={16} /></>}</button>
            </form>

            {DEMO && (
              <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
                <p className="label">Quick fill for reviewers</p>
                <div className="demo">
                  <button type="button" onClick={() => fill("admin@sutra.demo")}><span className="dot" />Demo: office admin</button>
                  <button type="button" onClick={() => fill("sanjay@sutra.demo")}><span className="dot" />Demo: faculty</button>
                </div>
              </div>
            )}
            <p className="muted" style={{ fontSize: 12 }}>Demo environment · synthetic data only</p>
          </div>
        </section>
      </div>
    </div>
  );
}