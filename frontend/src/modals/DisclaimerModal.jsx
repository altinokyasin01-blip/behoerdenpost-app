import Modal from "../components/Modal.jsx";

export default function DisclaimerModal({ onAcknowledge }) {
  return (
    <Modal onClose={() => {}} dismissable={false}>
      <div className="disclaimer">
        <h2 className="disclaimer-title">Willkommen</h2>
        <p className="disclaimer-text">
          Büro hilft dir, deine Post, Fristen und Termine im Griff zu behalten.
          Die App ersetzt keine Rechtsberatung. Bei komplexen Fällen wende dich
          an einen Anwalt oder Steuerberater.
        </p>
        <button
          type="button"
          className="btn-primary btn-primary-block"
          onClick={onAcknowledge}
        >
          Verstanden
        </button>
      </div>
    </Modal>
  );
}
