import { NavLink } from "react-router-dom";
import { LayoutGrid, Users, Layers, LogOut } from "lucide-react";
import { useAuth } from "../auth.jsx";
import Logo from "./Logo.jsx";

const NAV = [
  { to: "/", label: "Home", icon: LayoutGrid, end: true },
  { to: "/students", label: "Students", icon: Users },
  { to: "/masters", label: "Masters", icon: Layers, roles: ["ADMIN"] },
];

export default function Shell({ children }) {
  const { user, logout } = useAuth();
  const items = NAV.filter((n) => !n.roles || n.roles.includes(user.role));
  const initials = user.name.replace(/^(Dr\.|Prof\.)\s*/, "").split(" ").map((w) => w[0]).slice(0, 2).join("");

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><Logo /> Sutra</div>
        <nav className="nav" aria-label="Main">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}><Icon size={17} /> {label}</NavLink>
          ))}
        </nav>
        <div className="who">
          <div className="avatar">{initials}</div>
          <div className="who-text">
            <div className="who-name">{user.name}</div>
            <div className="who-sub">{user.role === "ADMIN" ? "Office admin" : "Faculty"} · {user.campus.code}</div>
          </div>
          <button className="icon-btn" aria-label="Sign out" onClick={logout}><LogOut size={16} /></button>
        </div>
      </aside>

      <main className="main">{children}</main>

      <nav className="tabbar" aria-label="Main">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}><Icon size={20} />{label}</NavLink>
        ))}
        <button onClick={logout}><LogOut size={20} />Sign out</button>
      </nav>
    </div>
  );
}