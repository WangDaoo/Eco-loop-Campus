import { useEffect } from "react";

export default function Modal({ open, title, children, onClose }) {
  useEffect(() => {
    if (!open || !onClose) return undefined;
    const handleKeyDown = event => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="eg-modal-backdrop" role="presentation" onClick={onClose}>
      <section className="eg-modal" role="dialog" aria-modal="true" aria-label={title} onClick={event => event.stopPropagation()}>
        <header className="eg-modal-head">
          <h2>{title}</h2>
          <button type="button" className="eg-icon-btn" onClick={onClose} aria-label="Đóng modal">×</button>
        </header>
        <div className="eg-modal-body">{children}</div>
      </section>
    </div>
  );
}
