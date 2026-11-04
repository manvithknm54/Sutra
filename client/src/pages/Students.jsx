import { useState } from "react";
import { Search } from "lucide-react";
import { useApi, useDebounced } from "../hooks.js";
import { PageHeader, Skeleton, ErrorState, Empty } from "../components/ui.jsx";

export default function Students() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim(), 300);
  const path = `/students?page=${page}&pageSize=25${q ? `&search=${encodeURIComponent(q)}` : ""}`;
  const { data, error, loading, reload } = useApi(path);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="page">
      <PageHeader
        title="Students"
        sub="Guardian numbers are masked in lists."
        action={
          <div className="search">
            <Search size={16} />
            <input className="input" placeholder="Search name or roll number" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search students" />
          </div>
        }
      />
      {error ? <ErrorState error={error} onRetry={reload} />
        : loading && !data ? <Skeleton />
        : !data.items.length ? <Empty title="No students found" hint={q ? "Try a different name or roll number." : "No students in your classes yet."} />
        : (
          <>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Roll no</th><th>Name</th><th>Programme</th><th>Category</th><th>Guardian</th><th>Consent</th></tr></thead>
                <tbody>
                  {data.items.map((s) => (
                    <tr key={s.id}>
                      <td className="mono">{s.rollNo}</td>
                      <td>{s.name}</td>
                      <td>{s.batch.programme.code} · {s.batch.label}</td>
                      <td>{s.category}</td>
                      <td className="mono">{s.guardianPhone ?? "—"}</td>
                      <td>
                        {!s.isMinor ? <span className="muted">—</span>
                          : s.guardianConsent ? <span className="badge ok">Minor · consent on file</span>
                          : <span className="badge risk">Minor · consent pending</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pager">
              <span>{(page - 1) * data.pageSize + 1}–{Math.min(page * data.pageSize, data.total)} of {data.total}</span>
              <div className="btns">
                <button className="btn ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <button className="btn ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          </>
        )}
    </div>
  );
}