import { NavLink } from "react-router-dom";

const navGroups = [
  { label: "Vận hành", paths: ["/dashboard", "/scans", "/bins", "/ai-test"] },
  { label: "Dữ liệu", paths: ["/users", "/ecopoints", "/reports", "/feedback"] },
  { label: "Hệ thống", paths: ["/model"] },
];

function groupItems(items) {
  const safeItems = Array.isArray(items) ? items : [];
  return navGroups.map(group => ({
    ...group,
    items: group.paths.map(path => safeItems.find(item => item.path === path)).filter(Boolean),
  })).filter(group => group.items.length);
}

export default function Sidebar({ items, open, onClose }) {
  const groups = groupItems(items);

  return (
    <aside className={`eg-sidebar ${open ? "is-open" : ""}`}>
      <div className="eg-brand">
        <div className="eg-brand-mark">EG</div>
        <div>
          <strong>EcoGuardian</strong>
          <span>Campus Admin</span>
        </div>
      </div>

      <nav className="eg-nav" aria-label="Menu quản trị">
        {groups.map(group => (
          <section key={group.label} className="eg-nav-group" aria-label={group.label}>
            <span className="eg-nav-heading">{group.label}</span>
            {group.items.map(item => {
              const Icon = item.icon;
              const hasIcon = typeof Icon === "function";
              return (
                <NavLink key={item.path} to={item.path} className={({ isActive }) => `eg-nav-link ${isActive ? "active" : ""}`} onClick={onClose}>
                  <span className="eg-nav-icon">{hasIcon && <Icon size={20} weight="duotone" aria-hidden="true" />}</span>
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </section>
        ))}
      </nav>

      <div className="eg-sidebar-footer">
        <span>Tình trạng campus</span>
        <strong>Đang vận hành</strong>
        <small>Supabase + AI test sẵn sàng</small>
      </div>
    </aside>
  );
}
