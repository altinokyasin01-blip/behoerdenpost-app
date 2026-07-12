import { useEffect, useState } from "react";
import { supabase } from "../supabase.js";
import { isValidEmail } from "../utils/format.js";
import LegalModal from "./LegalModal.jsx";

export default function OnboardingScreen({ session, skipWelcome, onDone }) {
  // Initial step:
  //   - Signed-in already (rare case: closed browser between auth and ready)  → step 3
  //   - Fresh install (no onboarding flag)                                    → step 1 (welcome)
  //   - Onboarding already completed but user is logged out (returning user)  → step 2 (auth)
  const [step, setStep] = useState(() => {
    if (session) return 3;
    if (skipWelcome) return 2;
    return 1;
  });
  const [authMode, setAuthMode] = useState("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [legalOpen, setLegalOpen] = useState(null);

  // If Supabase session appears while on step 2, advance to step 3.
  useEffect(() => {
    if (session && step === 2) {
      setStep(3);
    }
  }, [session, step]);

  function resetAuthMessages() {
    setError(null);
    setInfo(null);
  }

  async function handleLogin(e) {
    e.preventDefault();
    resetAuthMessages();
    if (!isValidEmail(email)) {
      setError("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }
    if (!password) {
      setError("Bitte gib dein Passwort ein.");
      return;
    }
    setLoading(true);
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (authErr) setError(authErr.message);
  }

  async function handleRegister(e) {
    e.preventDefault();
    resetAuthMessages();
    if (!isValidEmail(email)) {
      setError("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }
    if (password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    setLoading(true);
    const { data, error: authErr } = await supabase.auth.signUp({
      email,
      password,
    });
    setLoading(false);
    if (authErr) {
      setError(authErr.message);
      return;
    }
    if (!data.session) {
      setAuthMode("check-email");
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    resetAuthMessages();
    if (!isValidEmail(email)) {
      setError("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }
    setLoading(true);
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: window.location.origin }
    );
    setLoading(false);
    if (resetErr) {
      setError(resetErr.message);
      return;
    }
    setInfo("Falls die Adresse bekannt ist, haben wir dir einen Reset-Link geschickt.");
  }

  function finish(landing) {
    onDone(session?.user?.email || "", landing);
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="onboarding-stepper" aria-label={`Schritt ${step} von 3`}>
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`step-dot ${step >= n ? "active" : ""}`}
            />
          ))}
        </div>

        {step === 1 && (
          <>
            <div className="onboarding-logo">B</div>
            <h1 className="onboarding-title">Willkommen bei Büro</h1>
            <p className="onboarding-text">
              Dein persönlicher Assistent für alles was verwaltet werden will —
              Post scannen, Fristen im Blick, Kontakte an einem Ort.
            </p>
            <button
              type="button"
              className="btn-primary btn-primary-block"
              onClick={() => {
                resetAuthMessages();
                setStep(2);
              }}
            >
              Los geht's
            </button>
          </>
        )}

        {step === 2 && authMode === "register" && (
          <form onSubmit={handleRegister}>
            <h1 className="onboarding-title">Konto erstellen</h1>
            <p className="onboarding-text">
              Deine Daten liegen in deinem persönlichen Konto — überall
              zugänglich, sobald du dich anmeldest.
            </p>
            <input
              type="email"
              className="onboarding-input"
              placeholder="max@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
            />
            <input
              type="password"
              className="onboarding-input"
              placeholder="Passwort (min. 8 Zeichen)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            {error && <div className="onboarding-error">{error}</div>}
            <button
              type="submit"
              className="btn-primary btn-primary-block"
              disabled={loading}
            >
              {loading ? "Erstelle Konto…" : "Konto erstellen"}
            </button>
            <p className="onboarding-legal-hint">
              Mit der Registrierung akzeptierst du die{" "}
              <button
                type="button"
                className="legal-inline-link"
                onClick={() => setLegalOpen("agb")}
              >
                Nutzungsbedingungen
              </button>{" "}
              und die{" "}
              <button
                type="button"
                className="legal-inline-link"
                onClick={() => setLegalOpen("datenschutz")}
              >
                Datenschutzerklärung
              </button>
              .
            </p>
            <div className="auth-links">
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  resetAuthMessages();
                  setAuthMode("login");
                }}
              >
                Schon ein Konto? Anmelden
              </button>
            </div>
          </form>
        )}

        {step === 2 && authMode === "login" && (
          <form onSubmit={handleLogin}>
            <h1 className="onboarding-title">Willkommen zurück</h1>
            <p className="onboarding-text">
              Melde dich mit E-Mail und Passwort an.
            </p>
            <input
              type="email"
              className="onboarding-input"
              placeholder="max@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
            />
            <input
              type="password"
              className="onboarding-input"
              placeholder="Passwort"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {error && <div className="onboarding-error">{error}</div>}
            <button
              type="submit"
              className="btn-primary btn-primary-block"
              disabled={loading}
            >
              {loading ? "Melde an…" : "Anmelden"}
            </button>
            <div className="auth-links">
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  resetAuthMessages();
                  setAuthMode("forgot");
                }}
              >
                Passwort vergessen?
              </button>
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  resetAuthMessages();
                  setAuthMode("register");
                }}
              >
                Noch kein Konto? Registrieren
              </button>
            </div>
          </form>
        )}

        {step === 2 && authMode === "forgot" && (
          <form onSubmit={handleForgot}>
            <h1 className="onboarding-title">Passwort zurücksetzen</h1>
            <p className="onboarding-text">
              Wir schicken dir einen Link zum Ändern deines Passworts.
            </p>
            <input
              type="email"
              className="onboarding-input"
              placeholder="max@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
            />
            {error && <div className="onboarding-error">{error}</div>}
            {info && <div className="onboarding-info">{info}</div>}
            <button
              type="submit"
              className="btn-primary btn-primary-block"
              disabled={loading || !!info}
            >
              {loading ? "Sende…" : "Link senden"}
            </button>
            <div className="auth-links">
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  resetAuthMessages();
                  setAuthMode("login");
                }}
              >
                Zurück zum Login
              </button>
            </div>
          </form>
        )}

        {step === 2 && authMode === "check-email" && (
          <>
            <h1 className="onboarding-title">Prüfe dein Postfach</h1>
            <p className="onboarding-text">
              Wir haben dir eine Bestätigungs-E-Mail an{" "}
              <strong>{email}</strong> geschickt. Klicke den Link darin, um
              dein Konto zu aktivieren — danach kannst du dich hier anmelden.
            </p>
            <button
              type="button"
              className="btn-secondary btn-primary-block"
              onClick={() => {
                resetAuthMessages();
                setAuthMode("login");
              }}
            >
              Zurück zum Login
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="onboarding-title">Büro ist bereit</h1>
            <p className="onboarding-text">
              Laden Sie Ihre ersten Dokumente, Briefe oder Rechnungen über den
              Scan-Tab hoch — Büro erkennt automatisch was wichtig ist und
              behält den Überblick für Sie.
            </p>
            <div className="onboarding-examples">
              <div className="onboarding-examples-label">
                Was Sie hochladen können
              </div>
              <ul className="onboarding-examples-list">
                <li>Behördenbriefe &amp; Mahnungen</li>
                <li>Rechnungen &amp; Zahlungsaufforderungen</li>
                <li>Verträge &amp; wichtige Schreiben</li>
              </ul>
            </div>
            <div className="onboarding-actions">
              <button
                type="button"
                className="btn-primary btn-primary-block"
                onClick={() => finish("scan")}
              >
                Ersten Brief scannen
              </button>
              <button
                type="button"
                className="btn-secondary btn-primary-block"
                onClick={() => finish("home")}
              >
                Direkt zum Dashboard
              </button>
            </div>
          </>
        )}
      </div>
      {legalOpen && (
        <LegalModal type={legalOpen} onClose={() => setLegalOpen(null)} />
      )}
    </div>
  );
}
