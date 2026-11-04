import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { PageHeader, Skeleton, ErrorState, Empty } from "../components/ui.jsx";

const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

function AdminHome() {
  const { data, error, loading, reload } = useApi("/masters/summary");
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <Skeleton rows={2} />;
  const stats = [
    ["Students", data.students], ["Programmes", data.programmes],
    ["Faculty", data.faculty], ["Subjects", data.subjects], ["Class allocations", data.allocations],
  ];
  return (
    <div className="grid">
      {stats.map(([label, value]) => (
        <div key={label} className="card stat"><div className="label">{label}</div><div className="value">{value}</div></div>
      ))}
    </div>
  );
}

function MyClasses() {
  const { data, error, loading, reload } = useApi("/masters/allocations");
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !data) return <Skeleton rows={3} />;
  if (!data.items.length) return <Empty title="No classes yet" hint="Your office admin will allocate subjects to you." />;
  return (
    <>
      <h2 style={{ marginBottom: 12 }}>My classes</h2>
      <div className="grid">
        {data.items.map((a) => (
          <div key={a.id} className="card class-card">
            <h2>{a.subject.name}</h2>
            <div className="meta">{a.subject.code} · {a.batch.programme.code} {a.batch.label}</div>
            <div className="meta">{a.batch.programme.code} · Semester {a.subject.semester} · {a.batch._count.students} students</div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function Home() {
  const { user } = useAuth();
  const first = user.name.replace(/^(Dr\.|Prof\.)\s*/, "").split(" ")[0];
  return (
    <div className="page">
      <PageHeader title={`${greet()}, ${first}`} sub={user.campus.name} />
      {user.role === "ADMIN" ? <AdminHome /> : <MyClasses />}
    </div>
  );
}