import { STATUS_LABELS, getGroupColor } from "../data/wasteConfig";

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
}

export default function StatusBadge({ status, group, children }) {
  const normalizedStatus = normalizeStatus(status);
  const statusClass = normalizedStatus.replace(/[^a-z0-9_-]/g, "-");
  const label = children || STATUS_LABELS[normalizedStatus] || group || String(status || "").trim();
  const style = group ? { "--badge-color": getGroupColor(group) } : undefined;

  return (
    <span className={`eg-badge ${statusClass ? `is-${statusClass}` : ""} ${group ? "is-group" : ""}`} style={style}>
      {label}
    </span>
  );
}
