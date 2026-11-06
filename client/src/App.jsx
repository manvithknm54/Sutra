import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import Shell from "./components/Shell.jsx";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import Students from "./pages/Students.jsx";
import Masters from "./pages/Masters.jsx";
import Attendance from "./pages/Attendance.jsx";
import MarkAttendance from "./pages/MarkAttendance.jsx";
import Marks from "./pages/Marks.jsx";
import MarkSheet from "./pages/MarkSheet.jsx";

function Protected() {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <div className="splash">
        <span className="mark" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}

function RoleGate({ roles }) {
  const { user } = useAuth();

  return roles.includes(user.role)
    ? <Outlet />
    : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<Protected />}>
        <Route index element={<Home />} />
        <Route path="students" element={<Students />} />
        <Route path="marks" element={<Marks />} />
        <Route path="marks/:allocationId" element={<MarkSheet />} />

        {/* Admin-only routes */}
        <Route element={<RoleGate roles={["ADMIN"]} />}>
          <Route path="masters" element={<Masters />} />
        </Route>

        {/* Faculty-only attendance routes */}
        <Route element={<RoleGate roles={["FACULTY"]} />}>
          <Route path="attendance" element={<Attendance />} />
          <Route
            path="attendance/:allocationId"
            element={<MarkAttendance />}
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}