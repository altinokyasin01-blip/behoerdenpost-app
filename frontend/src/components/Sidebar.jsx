import { IconSearch, IconUser, IconMonitor, THEME_ICON } from "./icons.jsx";
import { NAV_ITEMS } from "../utils/navigation.jsx";
import { THEME_LABEL } from "../utils/storage.js";

export default function Sidebar({
  active,
  onChange,
  userEmail,
  onOpenSearch,
  badges = {},
  themeChoice,
  onCycleTheme,
  onSignOut,
}) {
  const ThemeIcon = THEME_ICON[themeChoice] || IconMonitor;
  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-mark">B</div>
        <div className="logo-text">Büro</div>
      </div>
      <button
        type="button"
        className="sidebar-search"
        onClick={onOpenSearch}
        aria-label="Suche öffnen"
      >
        <IconSearch size={16} />
        <span className="sidebar-search-label">Suchen…</span>
        <span className="sidebar-search-kbd">
          <kbd>⌘</kbd>
          <kbd>K</kbd>
        </span>
      </button>
      <nav className="nav-list">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`nav-item ${active === id ? "active" : ""}`}
            onClick={() => onChange(id)}
          >
            <Icon size={18} />
            <span>{label}</span>
            {badges[id] && <span className="nav-badge" />}
          </button>
        ))}
      </nav>
      {userEmail && (
        <div className="sidebar-user" title={userEmail}>
          <div className="user-avatar">
            <IconUser />
          </div>
          <div className="user-email">{userEmail}</div>
        </div>
      )}
      <button
        type="button"
        className="sidebar-theme"
        onClick={onCycleTheme}
        aria-label={`Design: ${THEME_LABEL[themeChoice]}`}
      >
        <ThemeIcon size={16} />
        <span>{THEME_LABEL[themeChoice]}</span>
      </button>
      {onSignOut && (
        <button
          type="button"
          className="sidebar-signout"
          onClick={onSignOut}
        >
          Abmelden
        </button>
      )}
    </aside>
  );
}
