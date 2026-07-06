import { useEffect } from "react";

export default function Modal({ onClose, children, dismissable = true }) {
  useEffect(() => {
    if (!dismissable) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, dismissable]);

  return (
    <div
      className="modal-overlay"
      onClick={dismissable ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        {dismissable && (
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Schließen"
          >
            ×
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
