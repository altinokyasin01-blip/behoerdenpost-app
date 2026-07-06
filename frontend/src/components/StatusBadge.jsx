export default function StatusBadge({ status }) {
  const map = { Offen: "red", Pending: "amber", Erledigt: "green" };
  return (
    <span className={`badge badge-${map[status] || "gray"}`}>{status}</span>
  );
}
