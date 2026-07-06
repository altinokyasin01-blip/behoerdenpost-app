export default function AuthConfigMissingScreen() {
  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="onboarding-logo">B</div>
        <h1 className="onboarding-title">Auth nicht konfiguriert</h1>
        <p className="onboarding-text">
          Die Datei <code>frontend/.env</code> braucht{" "}
          <code>VITE_SUPABASE_URL</code> und{" "}
          <code>VITE_SUPABASE_ANON_KEY</code>. Starte den Dev-Server nach dem
          Setzen der Variablen neu.
        </p>
      </div>
    </div>
  );
}
