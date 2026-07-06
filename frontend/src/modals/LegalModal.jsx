import Modal from "../components/Modal.jsx";
import { LEGAL_TEXTS } from "../utils/legal.jsx";

export default function LegalModal({ type, onClose }) {
  const info = LEGAL_TEXTS[type];
  if (!info) return null;
  return (
    <Modal onClose={onClose}>
      <div className="detail">
        <div className="detail-head">
          <div className="detail-title">{info.title}</div>
        </div>
        <div className="legal-text">{info.body}</div>
      </div>
    </Modal>
  );
}
