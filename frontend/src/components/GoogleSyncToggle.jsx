export default function GoogleSyncToggle({ checked, onChange }) {
  return (
    <label className="google-sync-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="google-sync-body">
        <div className="google-sync-title">Auch zu Google Calendar hinzufügen</div>
        <div className="google-sync-sub">Der Eintrag erscheint im verknüpften Google-Kalender.</div>
      </div>
    </label>
  );
}
