import {
  BellSimple,
  ChartBar,
  Coins,
  Cpu,
  Gauge,
  House,
  Palette,
  ListChecks,
  Trash,
  UsersThree,
} from "@phosphor-icons/react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import AiTesterPage from "./pages/AiTesterPage";
import AvatarPresetsPage from "./pages/AvatarPresetsPage";
import BinsPage from "./pages/BinsPage";
import DashboardPage from "./pages/DashboardPage";
import EcoPointsPage from "./pages/EcoPointsPage";
import FeedbackPage from "./pages/FeedbackPage";
import LoginPage from "./pages/LoginPage";
import ModelSettingsPage from "./pages/ModelSettingsPage";
import ReportsPage from "./pages/ReportsPage";
import ScansPage from "./pages/ScansPage";
import UsersPage from "./pages/UsersPage";
import { AdminAuthProvider, useAdminAuth } from "./services/authContext";

const navItems = [
  { path: "/dashboard", label: "Tổng quan", icon: House, element: <DashboardPage /> },
  { path: "/scans", label: "Lượt quét", icon: ListChecks, element: <ScansPage /> },
  { path: "/users", label: "Người dùng", icon: UsersThree, element: <UsersPage /> },
  { path: "/avatars", label: "Avatar", icon: Palette, element: <AvatarPresetsPage /> },
  { path: "/bins", label: "Thùng rác", icon: Trash, element: <BinsPage /> },
  { path: "/ecopoints", label: "Ecopoint", icon: Coins, element: <EcoPointsPage /> },
  { path: "/reports", label: "Báo cáo", icon: ChartBar, element: <ReportsPage /> },
  { path: "/feedback", label: "Phản hồi", icon: BellSimple, element: <FeedbackPage /> },
  { path: "/model", label: "Cài đặt model", icon: Cpu, element: <ModelSettingsPage /> },
  { path: "/ai-test", label: "Kiểm thử AI", icon: Gauge, element: <AiTesterPage /> },
];

function AdminLayout() {
  const [sidebarToggled, setSidebarToggled] = useState(false);

  return (
    <div className={`eg-shell ${sidebarToggled ? "is-sidebar-toggled" : ""}`}>
      <Sidebar items={navItems} open={sidebarToggled} onClose={() => setSidebarToggled(false)} />
      {sidebarToggled && <button type="button" className="eg-sidebar-backdrop" onClick={() => setSidebarToggled(false)} aria-label="Đóng menu" />}
      <main className="eg-main">
        <Topbar onToggleSidebar={() => setSidebarToggled(open => !open)} sidebarOpen={sidebarToggled} />
        <div className="eg-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            {navItems.map(item => <Route key={item.path} path={item.path} element={item.element} />)}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function LoadingPage() {
  return (
    <div className="eg-login-page">
      <section className="eg-login-card">
        <span>Eco-loop Campus</span>
        <h1>Đang kiểm tra phiên đăng nhập</h1>
        <p>Đang xác thực tài khoản quản trị.</p>
      </section>
    </div>
  );
}

function ForbiddenPage() {
  return (
    <div className="eg-login-page">
      <section className="eg-login-card">
        <span>Eco-loop Campus</span>
        <h1>Không có quyền truy cập</h1>
        <p>Tài khoản hiện tại không có vai trò admin trong Supabase.</p>
      </section>
    </div>
  );
}

function ProtectedAdmin() {
  const { loading, user, isAdmin } = useAdminAuth();

  if (loading) return <LoadingPage />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <ForbiddenPage />;

  return <AdminLayout />;
}

export default function AdminApp() {
  return (
    <HashRouter>
      <AdminAuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<ProtectedAdmin />} />
        </Routes>
      </AdminAuthProvider>
    </HashRouter>
  );
}
