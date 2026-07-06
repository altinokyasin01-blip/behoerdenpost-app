import { useEffect } from "react";

export default function SuccessToast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="success-toast" role="status">
      <span className="success-toast-icon">✓</span>
      <span>{message}</span>
    </div>
  );
}
