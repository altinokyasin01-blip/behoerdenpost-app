// Wiederverwendet für zwei Fälle: (1) initialer Datenload nach Login
// schlägt dauerhaft fehl, (2) React-Error-Boundary-Fallback bei einem
// unerwarteten Render-Fehler. Beides führte vorher zu einem für den Nutzer
// nicht unterscheidbaren weißen Bildschirm ohne jede Handlungsmöglichkeit.
export default function AppErrorScreen({ title, message }) {
  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="onboarding-logo">B</div>
        <h1 className="onboarding-title">{title}</h1>
        <p className="onboarding-text">{message}</p>
        <button
          type="button"
          className="btn-primary btn-primary-block"
          onClick={() => window.location.reload()}
        >
          Seite neu laden
        </button>
      </div>
    </div>
  );
}
