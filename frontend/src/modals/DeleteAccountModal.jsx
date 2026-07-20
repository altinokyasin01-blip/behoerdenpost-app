import { useState } from "react";
import Modal from "../components/Modal.jsx";

const CONFIRM_PHRASE = "LÖSCHEN";

// Fehler-Texte pro Schritt (backend/routes/account.js liefert `step` in der
// 500/207-Antwort). Bewusst pro Schritt unterschiedlich formuliert, nicht
// eine generische Meldung -- insbesondere der Hinweis "Abo bereits
// gekündigt" bei delete_data/delete_profile, damit ein Nutzer, der die
// Löschung abbricht, nicht überrascht ist, dass Smart-Features weg sind.
function errorMessage(step, stripeCancelled) {
  if (step === "cancel_subscription") {
    return "Die Kündigung deines Smart-Abos ist fehlgeschlagen. Es wurde noch nichts gelöscht — bitte versuche es später erneut.";
  }
  if (step === "delete_data" || step === "delete_profile") {
    return stripeCancelled
      ? "Löschung fehlgeschlagen. Hinweis: Dein Abo wurde bereits gekündigt. Bitte kontaktiere den Support, falls du es reaktivieren möchtest, und versuche die Löschung anschließend erneut."
      : "Löschung fehlgeschlagen. Bitte versuche es erneut.";
  }
  return "Etwas ist schiefgelaufen. Bitte versuche es erneut.";
}

export default function DeleteAccountModal({ onConfirm, onClose }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Case- und Whitespace-tolerant -- keine unnötige Reibung durch reine
  // Groß-/Kleinschreibungs-Fallstricke bei einer ohnehin schon bewusst
  // reibungsvollen Sicherheitsabfrage.
  const matches = input.trim().toUpperCase() === CONFIRM_PHRASE;

  async function handleConfirm() {
    if (!matches || loading) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
      // Bei Erfolg (oder dem 207-Sonderfall "Auth-Löschung fehlgeschlagen,
      // Rest aber erledigt") übernimmt der Aufrufer Reload/Weiterleitung --
      // dieses Modal wird dabei mit entfernt.
    } catch (err) {
      setError(err);
      setLoading(false);
    }
  }

  return (
    <Modal onClose={loading ? undefined : onClose} dismissable={!loading}>
      <div className="disclaimer">
        <h2 className="disclaimer-title">Konto endgültig löschen</h2>
        <p className="disclaimer-text">
          Dein Konto wird <strong>unwiderruflich</strong> gelöscht. Du kannst
          dich danach nicht mehr einloggen. Alle Daten, ein aktives Smart-Abo
          (wird zuerst gekündigt) und dein Zugang gehen dauerhaft verloren —
          es gibt keine Wiederherstellung.
        </p>
        <div className="form-field">
          <label>Gib zur Bestätigung „{CONFIRM_PHRASE}" ein</label>
          <input
            type="text"
            className="form-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            autoFocus
            placeholder={CONFIRM_PHRASE}
          />
        </div>
        {error && <div className="alert">{errorMessage(error.step, error.stripeCancelled)}</div>}
        <button
          type="button"
          className="btn-primary btn-primary-danger btn-primary-block"
          disabled={!matches || loading}
          onClick={handleConfirm}
        >
          {loading ? "Wird gelöscht…" : "Konto endgültig löschen"}
        </button>
        <button
          type="button"
          className="btn-secondary btn-primary-block"
          onClick={onClose}
          disabled={loading}
        >
          Abbrechen
        </button>
      </div>
    </Modal>
  );
}
