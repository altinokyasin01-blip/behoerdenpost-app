export default function TabTip({ text, onDismiss }) {
  return (
    <div className="tab-tip">
      <div className="tab-tip-body">{text}</div>
      <button
        type="button"
        className="tab-tip-close"
        onClick={onDismiss}
        aria-label="Verstanden"
      >
        Verstanden
      </button>
    </div>
  );
}
