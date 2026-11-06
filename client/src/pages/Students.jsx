import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useApi, useDebounced } from "../hooks.js";
import { PageHeader, Panel, Skeleton, ErrorState, Empty } from "../components/ui.jsx";

export default function Students() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const inputRef = useRef(null);
  const q = useDebounced(search.trim(), 300);
  const path = `/students?page=${page}&pageSize=25${q ? `&search=${encodeURIComponent(q)}` : ""}`;
  const { data, error, loading, reload } = useApi(path, ["masters"]);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) {
        e.preventDefault(); inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="page">
      <PageHeader eyebrow="Records" title="Students" sub="Guardian numbers are masked in lists." />
      <div className="controls">
        <div className="search">
          <Search size={16} />
          <input ref={inputRef} className="input" placeholder="Search by name or roll number" aria-label="Search students"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <span className="kbd">/</span>
        </div>
      </div>
      <Panel>
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
                        <td style={{ fontWeight: 500 }}>{s.name}</td>
                        <td>{s.batch.programme.code} · {s.batch.label}</td>
                        <td>{s.category}</td>
                        <td className="mono">{s.guardianPhone ?? "—"}</td>
                        <td>
                          {!s.isMinor ? <span className="muted">—</span>
                            : s.guardianConsent ? <span className="badge ok"><span className="dot" />Minor · consent on file</span>
                            : <span className="badge risk"><span className="dot" />Minor · consent pending</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="panel-foot">
                <span className="tnum">Showing {(page - 1) * data.pageSize + 1}–{Math.min(page * data.pageSize, data.total)} of {data.total} records</span>
                <div className="pager">
                  <button className="btn secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                  <button className="btn secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
              </div>
            </>
          )}
      </Panel>
    </div>
  );
}