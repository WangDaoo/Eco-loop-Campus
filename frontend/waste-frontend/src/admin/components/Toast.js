export default function Toast({ message, tone = "success", onClose }) {
  if (!message) return null;
  const normalizedTone = String(tone || "success").trim().toLowerCase();
  const safeTone = normalizedTone === "danger" ? "danger" : "success";

  return (
    <div className={`eg-toast tone-${safeTone}`} role="status">
      <span>{message}</span>
      {onClose && <button type="button" onClick={onClose} aria-label="Đóng thông báo">×</button>}
    </div>
  );
}
