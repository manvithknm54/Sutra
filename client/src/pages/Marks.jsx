import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "../auth.jsx";
import { useApi } from "../hooks.js";
import { Empty, ErrorState, Kpi, PageHeader, Panel, Skeleton, StatusBadge } from "../components/ui.jsx";

export default function Marks() {
  const { user } = useAuth();
  const admin = user.role === "ADMIN";
  const { data, error, loading, reload } = useApi("/marks");
  const count = (s) => data?.items.filter((i) => i.status === s).length ?? 0;

  return (
    <div className="page">
      <PageHeader
        eyebrow={admin ? "Examination desk" : "Faculty workspace"}
        title="Internal marks"
        sub={admin ? "Moderate submitted sheets, lock them, and export for the university." : "Enter marks by component, then submit for moderation."}
      />
      <div className="kpis">
        <Kpi label="Draft" value={count("DRAFT")} note="being entered" />
        <Kpi label="Awaiting moderation" value={count("SUBMITTED")} />
        <Kpi label="Moderated" value={count("MODERATED")} note="ready to lock" />
        <Kpi label="Locked" value={count("LOCKED")} />
      </div>
      <Panel title="Mark sheets">
        {error ? <ErrorState error={error} onRetry={reload} />
          : loading && !data ? <Skeleton rows={5} />
          : !data.items.length ? <Empty title="No mark sheets yet" hint="Sheets appear once subjects are allocated." />
          : (
            <div className="table-wrap"><table>
              <thead><tr><th>Course</th><th>Batch</th>{admin && <th>Faculty</th>}<th>Entered</th><th>Status</th><th></th></tr></thead>
              <tbody>{data.items.map((i) => (
                <tr key={i.id}>
                  <td><span className="mono muted" style={{ marginRight: 8 }}>{i.subject.code}</span><span style={{ fontWeight: 500 }}>{i.subject.name}</span></td>
                  <td>{i.batch.programme} · {i.batch.label}</td>
                  {admin && <td>{i.faculty}</td>}
                  <td style={{ minWidth: 150 }}>
                    <span className="gauge">
                      <span className="bar"><i style={{ width: `${i.expected ? (i.filled / i.expected) * 100 : 0}%` }} /></span>
                      <b className="tnum" style={{ minWidth: 64 }}>{i.filled}/{i.expected}</b>
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={i.status} />
                    {i.unlockRequested && <span className="badge" style={{ marginLeft: 6 }}>Unlock requested</span>}
                  </td>
                  <td className="num"><Link className="btn secondary" to={`/marks/${i.id}`}>Open <ArrowRight size={14} /></Link></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
      </Panel>
    </div>
  );
}