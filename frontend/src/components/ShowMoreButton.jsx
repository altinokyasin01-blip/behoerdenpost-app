export default function ShowMoreButton({ total, visibleCount, expanded, onToggle }) {
  if (total <= visibleCount) return null;
  return (
    <button type="button" className="btn-secondary btn-primary-sm" onClick={onToggle}>
      {expanded ? "Weniger anzeigen" : `Mehr anzeigen (${total - visibleCount})`}
    </button>
  );
}
