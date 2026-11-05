import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, CloudOff, RefreshCw } from "lucide-react";
import { useOfflineApi, useSync } from "../hooks.js";
import { discardQueued, listQueue, syncNow } from "../lib/offline.js";
import { Empty, ErrorState, PageHeader, Panel, Skeleton } from "../components/ui.jsx";

const STATE = {
  pending: ["Waiting to sync", ""],
  conflict: ["Needs review", "risk"],
  rejected: ["Rejected", "risk"],
};

export default function Attendance() {
  const classes = useOfflineApi("/masters/allocations", "allocations");
  const sync = useSync();
  const [queue, setQueue] = useState([]);
  useEffect(() => { listQueue().then((q) => setQueue(q.sort((a, b) => b.createdAt - a.createdAt))); },
    [sync.pending, sync.problems, sync.lastSyncAt]);

  return (
    <div className="page">
      <PageHeader eyebrow="Faculty workspace" title="Attendance" sub="Mark a class, and see what is waiting to sync from this device." />
      {!sync.online && <div className="notice" role="status"><CloudOff size={16} /> You're offline. Everything you mark is kept on this device.</div>}

      <Panel title="Mark a class">
        {classes.error ? <ErrorState error={classes.error} onRetry={classes.reload} />
          : classes.loading ? <Skeleton rows={3} />
          : !classes.data.items.length ? <Empty title="No classes assigned" />
          : (
            <div className="table-wrap"><table>
              <thead><tr><th>Course</th><th>Batch</th><th className="num">Students</th><th></th></tr></thead>
              <tbody>{classes.data.items.map((a) => (
                <tr key={a.id}>
                  <td><span className="mono muted" style={{ marginRight: 8 }}>{a.subject.code}</span><span style={{ fontWeight: 500 }}>{a.subject.name}</span></td>
                  <td>{a.batch.programme.code} · {a.batch.label}</td>
                  <td className="num">{a.batch._count.students}</td>
                  <td className="num"><Link className="btn" to={`/attendance/${a.id}`}>Mark <ArrowRight size={15} /></Link></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
      </Panel>

      <Panel
        title="On this device"
        meta={<button className="btn secondary" onClick={syncNow} disabled={!sync.online || sync.syncing || !sync.pending}><RefreshCw size={14} /> Sync now</button>}
      >
        {!queue.length ? (
          <div className="state"><CheckCircle2 size={22} style={{ color: "var(--teal)" }} /><h2>Nothing waiting</h2><p>Everything you marked has reached the server.</p></div>
        ) : (
          <div className="table-wrap"><table>
            <thead><tr><th>Class</th><th>Date</th><th className="num">Period</th><th className="num">Absent</th><th>Status</th><th></th></tr></thead>
            <tbody>{queue.map((i) => (
              <tr key={i.id}>
                <td style={{ fontWeight: 500 }}>{i.label}</td>
                <td className="tnum">{i.date}</td>
                <td className="num">{i.period}</td>
                <td className="num">{i.absentIds.length}</td>
                <td>
                  <span className={`badge ${STATE[i.state][1]}`}><span className="dot" />{STATE[i.state][0]}</span>
                  {i.message && <div className="qrow-msg">{i.message}</div>}
                </td>
                <td className="num">{i.state !== "pending" && <button className="btn secondary" onClick={() => discardQueued(i.id)}>Discard</button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Panel>
    </div>
  );
}