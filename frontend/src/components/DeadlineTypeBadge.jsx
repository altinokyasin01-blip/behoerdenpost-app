import { DEADLINE_TYPE_LABEL } from "../utils/domainConstants.js";

export default function DeadlineTypeBadge({ type }) {
  if (!type) return null;
  return (
    <span className={`deadline-type-badge deadline-type-${type}`}>
      {DEADLINE_TYPE_LABEL[type] || type}
    </span>
  );
}
