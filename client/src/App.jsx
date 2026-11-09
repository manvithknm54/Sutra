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
import Fees from "./pages/Fees.jsx";
import Receipt from "./pages/Receipt.jsx";
import Risk from "./pages/Risk.jsx";
import Alerts from "./pages/Alerts.jsx";
import PayLink from "./pages/PayLink.jsx";
import Ask from "./pages/Ask.jsx";

function Protected() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="splash"><span className="mark" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Shell><Outlet /></Shell>;
}

function RoleGate({ roles }) {
  const { user } = useAuth();
  return roles.includes(user.role) ? <Outlet /> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/pay/:token" element={<PayLink />} />
      <Route element={<Protected />}>
        <Route index element={<Home />} />
        <Route path="students" element={<Students />} />
        <Route path="marks" element={<Marks />} />
        <Route path="marks/:allocationId" element={<MarkSheet />} />
        <Route path="risk" element={<Risk />} />
        <Route element={<RoleGate roles={["ADMIN"]} />}>
          <Route path="masters" element={<Masters />} />
          <Route path="fees" element={<Fees />} />
          <Route path="receipt/:id" element={<Receipt />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="ask" element={<Ask />} />
        </Route>
        <Route element={<RoleGate roles={["FACULTY"]} />}>
          <Route path="attendance" element={<Attendance />} />
          <Route path="attendance/:allocationId" element={<MarkAttendance />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}