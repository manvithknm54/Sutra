import { useState } from "react";
import { Bell } from "lucide-react";
import { useApi } from "../hooks.js";
import { timeIN } from "../utils.js";
import { Empty, ErrorState, Modal, PageHeader, Panel, Skeleton } from "../components/ui.jsx";

const kindLabel = (k) => (k.startsWith("SHORTAGE") ? "Attendance shortage" : "Fee reminder");

function Preview({ a, onClose }) {
  const [lang, setLang] = useState("en");
  const [en, od] = a.body.split("\n");
  return (
    <Modal title={kindLabel(a.kind)} sub={`${a.student.name} · ${a.student.rollNo}`} icon={Bell} onClose={onClose}
      footer={<button className="btn" onClick={onClose}>Close</button>}>
      {a.held ? (
        <div className="callout"><Bell size={16} /><span>Held. This student is a minor and guardian consent is pending (DPDP), so nothing was sent.</span></div>
      ) : (
        <div className="seg" style={{ margin: 0 }} role="tablist">
          {[["en", "English"], ["od", "Odia"]].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={lang === k} className={lang === k ? "on" : ""} onClick={() => setLang(k)}>{l}</button>))}
        </div>)}
      <div className="sms">{a.held ? a.body : lang === "en" ? en : od ?? en}</div>
      <p className="muted" style={{ fontSize: 12 }}>Channel: {a.channel === "MOCK_SMS" ? "Mock SMS (nothing is actually sent)" : a.channel} · Week {a.weekKey} · {timeIN(a.at)}</p>
    </Modal>
  );
}

export default function Alerts() {
  const [group, setGroup] = useState("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const { data, error, loading, reload } = useApi(`/alerts?group=${group}&page=${page}&pageSize=25`, ["attendance", "fees"]);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <div className="page">
      <PageHeader eyebrow="Parent messages" title="Alerts"
        sub="Sent automatically: shortage below 75% (once a week per student) and weekly fee reminders. Messages are mocked in this build." />
      <div className="seg" role="tablist">
        {[["all", "All"], ["attendance", "Attendance"], ["fees", "Fees"]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={group === k} className={group === k ? "on" : ""} onClick={() => { setGroup(k); setPage(1); }}>{l}</button>))}
      </div>
      <Panel>
        {error ? <ErrorState error={error} onRetry={reload} />
          : loading && !data ? <Skeleton />
          : !data.items.length ? <Empty title="No alerts yet" hint="They appear when attendance or fees cross the limits." />
          : (
            <>
              <div className="table-wrap"><table>
                <thead><tr><th>When</th><th>Student</th><th>Type</th><th>Status</th><th>Channel</th></tr></thead>
                <tbody>{data.items.map((a) => (
                  <tr key={a.id} className="click" tabIndex={0} onClick={() => setOpen(a)} onKeyDown={(e) => e.key === "Enter" && setOpen(a)}>
                    <td className="tnum">{timeIN(a.at)}</td>
                    <td><b style={{ fontWeight: 500 }}>{a.student.name}</b> <span className="mono muted" style={{ marginLeft: 6 }}>{a.student.rollNo}</span></td>
                    <td>{kindLabel(a.kind)}</td>
                    <td>{a.held ? <span className="badge risk"><span className="dot" />Held · consent pending</span> : <span className="badge ok"><span className="dot" />Sent (mock)</span>}</td>
                    <td className="muted">{a.channel === "MOCK_SMS" ? "Mock SMS" : a.channel}</td>
                  </tr>))}</tbody>
              </table></div>
              <div className="panel-foot">
                <span className="tnum">{data.total} alerts</span>
                <div className="pager">
                  <button className="btn secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                  <button className="btn secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
              </div>
            </>
          )}
      </Panel>
      {open && <Preview a={open} onClose={() => setOpen(null)} />}
    </div>
  );
}