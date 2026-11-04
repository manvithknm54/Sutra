import { useState } from "react";
import { api } from "../api";
import { useApi } from "../hooks.js";
import { PageHeader, Skeleton, ErrorState, Empty } from "../components/ui.jsx";

const TABS = ["Programmes", "Subjects", "Allocations", "Faculty"];

function Async({ res, children, emptyTitle }) {
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />;
  if (res.loading && !res.data) return <Skeleton rows={4} />;
  if (!res.data.items.length) return <Empty title={emptyTitle} />;
  return children(res.data.items);
}

function useForm(initial, onSubmit) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  async function submit(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try { await onSubmit(form); setForm(initial); } catch (x) { setError(x.message); } finally { setBusy(false); }
  }
  return { form, setForm, set, error, busy, submit };
}

function ProgrammesTab() {
  const res = useApi("/masters/programmes");
  return (
    <Async res={res} emptyTitle="No programmes">
      {(items) => (
        <div className="grid">
          {items.map((p) => (
            <div key={p.id} className="card class-card">
              <h2>{p.name}</h2>
              <div className="meta">{p.code} · {p.years} years · {p._count.subjects} subjects</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {p.batches.map((b) => <span key={b.id} className="badge ok">{b.label} · {b._count.students} students</span>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Async>
  );
}

function SubjectsTab() {
  const subjects = useApi("/masters/subjects");
  const programmes = useApi("/masters/programmes");
  const f = useForm({ programmeId: "", code: "", name: "", semester: "" }, async (form) => {
    await api("/masters/subjects", { method: "POST", body: { ...form, semester: Number(form.semester) } });
    subjects.reload();
  });
  return (
    <>
      <form className="form-row" onSubmit={f.submit}>
        <div className="field"><label>Programme</label>
          <select className="select" value={f.form.programmeId} onChange={f.set("programmeId")} required>
            <option value="">Select…</option>
            {programmes.data?.items.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
          </select></div>
        <div className="field"><label>Code</label><input className="input" value={f.form.code} onChange={f.set("code")} placeholder="CS304" required /></div>
        <div className="field"><label>Name</label><input className="input" value={f.form.name} onChange={f.set("name")} placeholder="Computer Networks" required /></div>
        <div className="field"><label>Semester</label><input className="input" type="number" min="1" max="12" value={f.form.semester} onChange={f.set("semester")} required /></div>
        <button className="btn" disabled={f.busy}>{f.busy ? "Adding…" : "Add subject"}</button>
      </form>
      {f.error && <div className="form-error" role="alert">{f.error}</div>}
      <Async res={subjects} emptyTitle="No subjects yet">
        {(items) => (
          <div className="table-wrap"><table>
            <thead><tr><th>Code</th><th>Subject</th><th>Programme</th><th>Semester</th></tr></thead>
            <tbody>{items.map((s) => (
              <tr key={s.id}><td className="mono">{s.code}</td><td>{s.name}</td><td>{s.programme.code}</td><td>{s.semester}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </Async>
    </>
  );
}

function AllocationsTab() {
  const allocs = useApi("/masters/allocations");
  const subjects = useApi("/masters/subjects");
  const programmes = useApi("/masters/programmes");
  const faculty = useApi("/masters/faculty");
  const f = useForm({ subjectId: "", batchId: "", facultyId: "" }, async (form) => {
    await api("/masters/allocations", { method: "POST", body: form });
    allocs.reload();
  });
  const chosen = subjects.data?.items.find((s) => s.id === f.form.subjectId);
  const batches = programmes.data?.items.find((p) => p.id === chosen?.programmeId)?.batches ?? [];

  return (
    <>
      <form className="form-row" onSubmit={f.submit}>
        <div className="field"><label>Subject</label>
          <select className="select" value={f.form.subjectId}
            onChange={(e) => f.setForm((x) => ({ ...x, subjectId: e.target.value, batchId: "" }))} required>
            <option value="">Select…</option>
            {subjects.data?.items.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
          </select></div>
        <div className="field"><label>Batch</label>
          <select className="select" value={f.form.batchId} onChange={f.set("batchId")} required disabled={!chosen}>
            <option value="">Select…</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select></div>
        <div className="field"><label>Faculty</label>
          <select className="select" value={f.form.facultyId} onChange={f.set("facultyId")} required>
            <option value="">Select…</option>
            {faculty.data?.items.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select></div>
        <button className="btn" disabled={f.busy}>{f.busy ? "Allocating…" : "Allocate"}</button>
      </form>
      {f.error && <div className="form-error" role="alert">{f.error}</div>}
      <Async res={allocs} emptyTitle="No allocations yet">
        {(items) => (
          <div className="table-wrap"><table>
            <thead><tr><th>Subject</th><th>Batch</th><th>Faculty</th><th>Students</th></tr></thead>
            <tbody>{items.map((a) => (
              <tr key={a.id}>
                <td>{a.subject.code} · {a.subject.name}</td>
                <td>{a.batch.programme.code} {a.batch.label}</td>
                <td>{a.faculty.name}</td><td>{a.batch._count.students}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Async>
    </>
  );
}

function FacultyTab() {
  const res = useApi("/masters/faculty");
  return (
    <Async res={res} emptyTitle="No faculty">
      {(items) => (
        <div className="table-wrap"><table>
          <thead><tr><th>Name</th><th>Email</th><th>Classes</th></tr></thead>
          <tbody>{items.map((u) => (
            <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u._count.allocations}</td></tr>
          ))}</tbody>
        </table></div>
      )}
    </Async>
  );
}

export default function Masters() {
  const [tab, setTab] = useState("Programmes");
  return (
    <div className="page">
      <PageHeader title="Masters" sub="Programmes, subjects, faculty and who teaches what." />
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === "Programmes" && <ProgrammesTab />}
      {tab === "Subjects" && <SubjectsTab />}
      {tab === "Allocations" && <AllocationsTab />}
      {tab === "Faculty" && <FacultyTab />}
    </div>
  );
}