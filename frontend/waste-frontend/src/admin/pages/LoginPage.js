import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Toast from "../components/Toast";
import { useAdminAuth } from "../services/authContext";
import { signInAdmin } from "../services/supabaseStore";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const navigate = useNavigate();
  const { applyAuthUser } = useAdminAuth();
  const [email, setEmail] = useState("admin@school.edu.vn");
  const [password, setPassword] = useState("admin-demo");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  const submitLogin = async event => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    const normalizedPassword = password.trim();
    if (!normalizedEmail || !normalizedPassword) {
      setToast("Không đăng nhập được: Nhập email và mật khẩu.");
      return;
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setToast("Không đăng nhập được: Email không hợp lệ.");
      return;
    }
    setLoading(true);
    try {
      const authData = await signInAdmin(normalizedEmail, normalizedPassword);
      const authUser = authData?.user || authData?.session?.user || null;
      const authState = await applyAuthUser(authUser);
      if (!authState.profile) throw new Error(authState.error?.message || "Tài khoản chưa có quyền admin hoặc đang bị khóa.");
      setToast("Đã đăng nhập Supabase Auth");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      const message = error?.message || "Kiểm tra Supabase Auth hoặc tài khoản admin.";
      setToast(`Không đăng nhập được: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="eg-login-page">
      <form className="eg-login-card" onSubmit={submitLogin}>
        <span>EcoGuardian</span>
        <h1>Đăng nhập quản trị</h1>
        <p>Dùng Supabase Auth email/password. Tài khoản phải có vai trò admin trong bảng users.</p>
        <label>Email<input value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" /></label>
        <label>Mật khẩu<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" /></label>
        <button type="submit" className="eg-primary-btn" disabled={loading}>{loading ? "Đang đăng nhập" : "Đăng nhập"}</button>
      </form>
      <Toast message={toast} tone={toast.includes("Không") ? "danger" : "success"} onClose={() => setToast("")} />
    </div>
  );
}
