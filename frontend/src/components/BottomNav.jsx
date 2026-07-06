import { NAV_ITEMS } from "../utils/navigation.jsx";

export default function BottomNav({ active, onChange, badges = {} }) {
  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`bottom-nav-item ${active === id ? "active" : ""}`}
          onClick={() => onChange(id)}
        >
          <Icon size={22} />
          <span>{label}</span>
          {badges[id] && <span className="nav-badge" />}
        </button>
      ))}
    </nav>
  );
}
