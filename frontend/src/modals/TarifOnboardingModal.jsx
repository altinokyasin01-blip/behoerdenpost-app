import Modal from "../components/Modal.jsx";

// daysRemaining kommt vom Server (billingStatus.trialDaysRemaining) -- nie
// hartcodiert, damit dieser Text korrekt bleibt, falls das Popup (z.B. durch
// einen verlorenen localStorage-Flag) während eines bereits laufenden Trials
// erneut auftaucht, statt fälschlich immer "3 Tage" zu behaupten.
export default function TarifOnboardingModal({ onClose, daysRemaining }) {
  const days = daysRemaining ?? 3;
  const dayLabel = `${days} Tag${days === 1 ? "" : "e"}`;
  return (
    <Modal onClose={onClose}>
      <div className="disclaimer">
        <h2 className="disclaimer-title">Dein Trial läuft — noch {dayLabel} Smart</h2>
        <p className="disclaimer-text">
          Du hast Smart aktuell voll freigeschaltet: unlimitierte Scans,
          Vorlagen-Erstellung, Widerspruch-Analyse, File System Access und
          erweiterten Export.
        </p>
        <p className="disclaimer-text">
          Noch {dayLabel}, danach läuft's weiter mit 10 Gratis-Scans pro
          Monat (Basic) — oder du bleibst für 3,90€/Monat bei Smart.
          Jederzeit in den Einstellungen unter „Abo" wechselbar.
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
