import { useState } from "react";
import { api } from "../api";
import { useApi } from "../hooks.js";
import { PageHeader, Panel, Skeleton, ErrorState, Empty } from "../components/ui.jsx";

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

const Count = ({ n, label }) => <span className="muted" style={{ fontSize: 12 }}>{n} {label}</span>;

function ProgrammesTab() {
  const res = useApi("/masters/programmes");
  return (
    <Panel title="Programmes" meta={res.data && <Count n={res.data.items.length} label="programmes" />}>
      <Async res={res} emptyTitle="No programmes">
        {(items) => (
          <div className="table-wrap"><table>
            <thead><tr><th>Programme</th><th>Code</th><th className="num">Years</th><th>Batches</th><th className="num">Subjects</th></tr></thead>
            <tbody>{items.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 500 }}>{p.name}</td><td className="mono">{p.code}</td><td className="num">{p.years}</td>
                <td>{p.batches.map((b) => <span key={b.id} className="badge ok" style={{ marginRight: 6 }}>{b.label} · {b._count.students}</span>)}</td>
                <td className="num">{p._count.subjects}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Async>
    </Panel>
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
      <Panel title="Add subject">
        <form className="panel-body" onSubmit={f.submit}>
          <div className="form-row">
            <div className="field"><label>Programme</label>
              <select className="select" value={f.form.programmeId} onChange={f.set("programmeId")} required>
                <option value="">Select…</option>
                {programmes.data?.items.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
              </select></div>
            <div className="field"><label>Code</label><input className="input" value={f.form.code} onChange={f.set("code")} placeholder="CS304" required /></div>
            <div className="field"><label>Name</label><input className="input" value={f.form.name} onChange={f.set("name")} placeholder="Computer Networks" required /></div>
            <div className="field"><label>Semester</label><input className="input" type="number" min="1" max="12" value={f.form.semester} onChange={f.set("semester")} required /></div>
            <button className="btn" disabled={f.busy}>{f.busy ? "Adding…" : "Add subject"}</button>
          </div>
          {f.error && <p className="helper-err" role="alert">{f.error}</p>}
        </form>
      </Panel>
      <Panel title="Subjects" meta={subjects.data && <Count n={subjects.data.items.length} label="subjects" />}>
        <Async res={subjects} emptyTitle="No subjects yet">
          {(items) => (
            <div className="table-wrap"><table>
              <thead><tr><th>Code</th><th>Subject</th><th>Programme</th><th className="num">Semester</th></tr></thead>
              <tbody>{items.map((s) => (
                <tr key={s.id}><td className="mono">{s.code}</td><td style={{ fontWeight: 500 }}>{s.name}</td><td>{s.programme.code}</td><td className="num">{s.semester}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </Async>
      </Panel>
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
      <Panel title="Allocate a class">
        <form className="panel-body" onSubmit={f.submit}>
          <div className="form-row">
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
          </div>
          {f.error && <p className="helper-err" role="alert">{f.error}</p>}
        </form>
      </Panel>
      <Panel title="Allocation matrix" meta={allocs.data && <Count n={allocs.data.items.length} label="allocations" />}>
        <Async res={allocs} emptyTitle="No allocations yet">
          {(items) => (
            <div className="table-wrap"><table>
              <thead><tr><th>Course</th><th>Faculty</th><th>Batch</th><th className="num">Students</th></tr></thead>
              <tbody>{items.map((a) => (
                <tr key={a.id}>
                  <td><span className="mono muted" style={{ marginRight: 8 }}>{a.subject.code}</span><span style={{ fontWeight: 500 }}>{a.subject.name}</span></td>
                  <td>{a.faculty.name}</td>
                  <td>{a.batch.programme.code} · {a.batch.label}</td>
                  <td className="num">{a.batch._count.students}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Async>
      </Panel>
    </>
  );
}

function FacultyTab() {
  const res = useApi("/masters/faculty");
  return (
    <Panel title="Faculty" meta={res.data && <Count n={res.data.items.length} label="faculty" />}>
      <Async res={res} emptyTitle="No faculty">
        {(items) => (
          <div className="table-wrap"><table>
            <thead><tr><th>Name</th><th>Email</th><th className="num">Classes</th></tr></thead>
            <tbody>{items.map((u) => (
              <tr key={u.id}><td style={{ fontWeight: 500 }}>{u.name}</td><td>{u.email}</td><td className="num">{u._count.allocations}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </Async>
    </Panel>
  );
}

export default function Masters() {
  const [tab, setTab] = useState("Programmes");
  return (
    <div className="page">
      <PageHeader eyebrow="Configuration" title="Masters" sub="Programmes, subjects, faculty and who teaches what." />
      <div className="seg" role="tablist">
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