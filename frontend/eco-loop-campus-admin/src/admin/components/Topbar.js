import { Bell, CheckCircle, List, MagnifyingGlass, SignOut, UserCircle } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "../services/authContext";
import { signOutAdmin } from "../services/supabaseStore";

export default function Topbar({ onToggleSidebar, sidebarOpen }) {
  const navigate = useNavigate();
  const { profile } = useAdminAuth();
  const today = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());

  const logout = async () => {
    try {
      await signOutAdmin();
    } catch (error) {
      // The admin should leave the shell even when the remote sign-out request fails.
    }
    navigate("/login", { replace: true });
  };

  return (
    <header className="eg-topbar">
      <button type="button" className="eg-icon-btn eg-menu-btn" onClick={onToggleSidebar} aria-label="Mở menu" aria-expanded={sidebarOpen}>
        <List size={24} />
      </button>
      <label className="eg-search">
        <MagnifyingGlass size={18} aria-hidden="true" />
        <input type="search" aria-label="Tìm kiếm quản trị" placeholder="Tìm kiếm lượt quét, người dùng, thùng rác" />
      </label>
      <div className="eg-top-actions">
        <span className="eg-live-pill"><CheckCircle size={16} weight="fill" aria-hidden="true" /> Trực tuyến</span>
        <span className="eg-date">{today}</span>
        <button type="button" className="eg-icon-btn" aria-label="Thông báo">
          <Bell size={20} />
        </button>
        <button type="button" className="eg-profile-btn">
          <UserCircle size={24} weight="duotone" />
          <span>{profile?.name || "Admin"}</span>
        </button>
        <button type="button" className="eg-icon-btn" aria-label="Đăng xuất" onClick={logout}>
          <SignOut size={20} />
        </button>
      </div>
    </header>
  );
}
