import { Link } from "react-router-dom";
import { useSync } from "../hooks.js";

export default function SyncChip() {
  const s = useSync();
  let label = "All synced", tone = "";
  if (!s.online) label = s.pending ? `Offline · ${s.pending} saved` : "Offline";
  else if (s.syncing) label = "Syncing…";
  else if (s.problems) { label = `${s.problems} need attention`; tone = "risk"; }
  else if (s.pending) label = `${s.pending} pending sync`;
  return (
    <Link to="/attendance" className={`badge sync ${tone}`} aria-live="polite">
      <span className="dot" />{label}
    </Link>
  );
}