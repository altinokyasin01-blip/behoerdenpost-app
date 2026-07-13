import Modal from "../components/Modal.jsx";

export default function TarifOnboardingModal({ onClose }) {
  return (
    <Modal onClose={onClose}>
      <div className="disclaimer">
        <h2 className="disclaimer-title">Dein Trial läuft — 3 Tage Smart</h2>
        <p className="disclaimer-text">
          Ab jetzt hast du 3 Tage lang alle Smart-Funktionen freigeschaltet:
          unlimitierte Scans, Vorlagen-Erstellung, Widerspruch-Analyse, File
          System Access und erweiterten Export.
        </p>
        <p className="disclaimer-text">
          Danach läuft's weiter mit 10 Gratis-Scans pro Monat (Basic) — oder
          du bleibst für 3,90€/Monat bei Smart. Jederzeit in den
          Einstellungen unter „Abo" wechselbar.
        </p>
        <button
          type="button"
          className="btn-primary btn-primary-block"
          onClick={onClose}
        >
          Los geht's
        </button>
      </div>
    </Modal>
  );
}
