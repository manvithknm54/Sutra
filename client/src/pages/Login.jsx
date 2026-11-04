import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import Logo from "../components/Logo.jsx";

const DEMO = import.meta.env.VITE_DEMO === "true";

export default function Login() {
  const { user, ready, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
  const fill = (e) => { setEmail(e); setPassword("Sutra@2026"); setError(""); };

  return (
    <div className="auth">
      <section className="auth-art">
        <div className="brand"><Logo /> Sutra</div>
        <div>
          <h1>One student. One record.</h1>
          <p>Admission to graduation in a single thread: attendance, marks and fees, calm enough to use all day.</p>
        </div>
        <span className="muted">Demo campus · synthetic data</span>
      </section>

      <section className="auth-form">
        <form onSubmit={submit}>
          <div><h1>Sign in</h1><p className="muted">Use your campus account.</p></div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="pw">Password</label>
            <input id="pw" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div className="form-error" role="alert" style={{ margin: 0 }}>{error}</div>}
          <button className="btn" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          {DEMO && (
            <div className="demo" aria-label="Demo accounts">
              <button type="button" className="badge" onClick={() => fill("admin@sutra.demo")}>Demo: office admin</button>
              <button type="button" className="badge" onClick={() => fill("sanjay@sutra.demo")}>Demo: faculty</button>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}