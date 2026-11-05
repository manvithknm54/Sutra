import { Link } from "react-router-dom";
import { ArrowRight, CloudOff, Users } from "lucide-react";
import { useAuth } from "../auth.jsx";
import { useApi, useOfflineApi } from "../hooks.js";
import { greet, firstName, longDate } from "../utils.js";
import { PageHeader, Kpi, Panel, Skeleton, ErrorState, Empty } from "../components/ui.jsx";

function AdminHome() {
  const summary = useApi("/masters/summary");
  const programmes = useApi("/masters/programmes");

  if (summary.error) return <ErrorState error={summary.error} onRetry={summary.reload} />;

  const s = summary.data;

  return (
    <>
      {summary.loading && !s ? <Skeleton rows={1} /> : (
        <div className="kpis">
          <Kpi label="Students" value={s.students} note="across all programmes" />
          <Kpi label="Programmes" value={s.programmes} />
          <Kpi label="Faculty" value={s.faculty} />
          <Kpi label="Subjects" value={s.subjects} />
          <Kpi label="Class allocations" value={s.allocations} note="subject × batch × faculty" />
        </div>
      )}

      <Panel title="Programmes">
        {programmes.error ? <ErrorState error={programmes.error} onRetry={programmes.reload} />
          : programmes.loading && !programmes.data ? <Skeleton rows={3} />
          : !programmes.data.items.length ? <Empty title="No programmes yet" />
          : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Programme</th>
                    <th>Code</th>
                    <th>Batches</th>
                    <th className="num">Subjects</th>
                    <th className="num">Students</th>
                  </tr>
                </thead>
                <tbody>
                  {programmes.data.items.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td className="mono">{p.code}</td>
                      <td>
                        {p.batches.map((b) => (
                          <span key={b.id} className="badge" style={{ marginRight: 6 }}>
                            {b.label}
                          </span>
                        ))}
                      </td>
                      <td className="num">{p._count.subjects}</td>
                      <td className="num">
                        {p.batches.reduce((n, b) => n + b._count.students, 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Panel>
    </>
  );
}

function MyClasses() {
  const { data, error, loading, reload, stale } = useOfflineApi(
    "/masters/allocations",
    "allocations"
  );

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading) return <Skeleton rows={3} />;

  const items = data.items;

  if (!items.length) {
    return (
      <Panel>
        <Empty
          title="No classes yet"
          hint="Your office admin will allocate subjects to you."
        />
      </Panel>
    );
  }

  const batches = new Map(items.map((a) => [a.batchId, a.batch._count.students]));
  const students = [...batches.values()].reduce((n, c) => n + c, 0);

  return (
    <>
      {stale && (
        <div className="notice">
          <CloudOff size={16} />
          Showing the list saved on this device.
        </div>
      )}

      <div className="kpis">
        <Kpi label="Classes assigned" value={items.length} note="this term" />
        <Kpi
          label="Students"
          value={students}
          note={`across ${batches.size} ${batches.size === 1 ? "batch" : "batches"}`}
        />
      </div>

      <Panel
        title="My classes"
        meta={
          <span className="muted" style={{ fontSize: 12 }}>
            {items.length} assigned
          </span>
        }
      >
        <div className="panel-body classes">
          {items.map((a) => (
            <article key={a.id} className="class">
              <div className="chips">
                <span className="badge">{a.subject.code}</span>
                <span className="badge">Semester {a.subject.semester}</span>
              </div>

              <h2>{a.subject.name}</h2>

              <p className="meta">
                B.Tech {a.batch.programme.code} · Batch {a.batch.label}
              </p>

              <div className="strip">
                <span className="l">
                  <Users size={15} />
                  {a.batch._count.students} students
                </span>

                <Link className="btn" to={`/attendance/${a.id}`}>
                  Take attendance
                  <ArrowRight size={15} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </>
  );
}

export default function Home() {
  const { user } = useAuth();
  const admin = user.role === "ADMIN";

  return (
    <div className="page">
      <PageHeader
        eyebrow={admin ? "Office administration" : "Faculty workspace"}
        title={`${greet()}, ${firstName(user.name)}`}
        sub={longDate()}
      />

      {admin ? <AdminHome /> : <MyClasses />}
    </div>
  );
}