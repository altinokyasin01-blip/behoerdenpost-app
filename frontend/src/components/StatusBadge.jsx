const STATUS_COLOR = { Offen: "red", Laufend: "amber", Erledigt: "green" };

export default function StatusBadge({ status }) {
  // null ("Kein Status") renders no badge at all, not an empty gray pill —
  // some document types (e.g. a Führungszeugnis) have no meaningful status.
  if (!status) return null;
  return (
    <span className={`badge badge-${STATUS_COLOR[status] || "gray"}`}>
      {status}
    </span>
  );
}
