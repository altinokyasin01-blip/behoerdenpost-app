import Modal from "../components/Modal.jsx";

const COPY = {
  scan: {
    title: "Scan-Kontingent erreicht",
    text: "Deine 10 Gratis-Scans für diesen Monat sind aufgebraucht. Mit Smart scannst du unlimitiert — oder du kaufst dir 15 zusätzliche Scans/Vorlagen für 0,50€.",
  },
  template: {
    title: "Vorlagen-Erstellung braucht Smart oder Credits",
    text: "Vorlagen sind bei Basic nicht im Gratis-Kontingent enthalten. Mit Smart unlimitiert nutzbar — oder du kaufst dir 15 Credits für 0,50€.",
  },
  appeal: {
    title: "Widerspruch-Analyse ist ein Smart-Feature",
    text: "Diese Einschätzung ist Teil von Smart — unlimitierte Scans, Vorlagen-Erstellung und Widerspruch-Analyse für 3,90€/Monat.",
  },
};

export default function UpsellModal({ action, onClose, onOpenShop }) {
  const copy = COPY[action] || COPY.scan;
  return (
    <Modal onClose={onClose}>
      <div className="disclaimer">
        <h2 className="disclaimer-title">{copy.title}</h2>
        <p className="disclaimer-text">{copy.text}</p>
        <button
          type="button"
          className="btn-primary btn-primary-block"
          onClick={onOpenShop}
        >
          Zum Shop
        </button>
      </div>
    </Modal>
  );
}
