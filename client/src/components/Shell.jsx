import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { Bell, CalendarDays, GraduationCap, IndianRupee, LayoutDashboard, LogOut, ShieldAlert, SlidersHorizontal, SquarePen, UserCheck } from "lucide-react";
import { useAuth } from "../auth.jsx";
import { TERM_LABEL } from "../config.js";
import { initSync } from "../lib/offline.js";
import { connectLive, disconnectLive } from "../lib/live.js";
import { initials } from "../utils.js";
import Logo from "./Logo.jsx";
import SyncChip from "./SyncChip.jsx";

const ADMIN_NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/fees", label: "Fees", icon: IndianRupee },
  { to: "/marks", label: "Marks", icon: SquarePen },
  { to: "/risk", label: "At risk", icon: ShieldAlert },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/students", label: "Students", icon: GraduationCap },
  { to: "/masters", label: "Masters", icon: SlidersHorizontal },
];
const FACULTY_NAV = [
  { to: "/", label: "My Classes", icon: CalendarDays, end: true },
  { to: "/attendance", label: "Attendance", icon: UserCheck },
  { to: "/marks", label: "Marks", icon: SquarePen },
  { to: "/risk", label: "At risk", icon: ShieldAlert },
  { to: "/students", label: "Students", icon: GraduationCap },
];

export default function Shell({ children }) {
  const { user, logout } = useAuth();
  const nav = user.role === "ADMIN" ? ADMIN_NAV : FACULTY_NAV;
  const role = user.role === "ADMIN" ? "Office admin" : "Faculty";

  useEffect(() => (user.role === "FACULTY" ? initSync() : undefined), [user.role]);
  useEffect(() => { connectLive(); return disconnectLive; }, []); // one live channel for the whole session

  return (
    <div>
      <aside className="sidebar">
        <div>
          <div className="sb-brand"><span className="sb-bar" /><span className="sb-name">Sutra</span><span className="sb-tag">ERP</span></div>
          <div className="sb-section">
            <p className="label">Academic operations</p>
            <nav className="sb-nav" aria-label="Main">
              {nav.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end}><Icon size={18} />{label}</NavLink>
              ))}
            </nav>
          </div>
        </div>
        <div className="sb-user">
          <div className="avatar">{initials(user.name)}</div>
          <div className="who"><b>{user.name}</b><span>{role} · {user.campus.code}</span></div>
          <button className="icon-btn" aria-label="Sign out" title="Sign out" onClick={logout}><LogOut size={17} /></button>
        </div>
      </aside>

      <header className="topbar">
        <div className="brand-m"><Logo size={26} /> Sutra</div>
        <div className="tb-left hide-m">
          <b>{user.campus.code} Campus</b><span className="dotsep">·</span><span>{user.campus.name}</span>
        </div>
        <div className="tb-right">
          {user.role === "FACULTY" && <SyncChip />}
          <span className="badge">{TERM_LABEL}</span>
          <div className="avatar" style={{ borderRadius: "50%" }} title={user.name}>{initials(user.name)}</div>
        </div>
      </header>

      <main className="content"><div className="main">{children}</div></main>

      <nav className="tabbar" aria-label="Main">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}><Icon size={20} />{label}</NavLink>
        ))}
        <button onClick={logout}><LogOut size={20} />Sign out</button>
      </nav>
    </div>
  );
}