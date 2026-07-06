import { useState } from "react";
import Modal from "../components/Modal.jsx";
import { DEADLINE_TYPES, DEADLINE_TYPE_LABEL } from "../utils/domainConstants.js";

export default function DeadlineEditModal({ doc, onSave, onCancel }) {
  const [date, setDate] = useState(doc.deadline || "");
  const [type, setType] = useState(doc.deadlineType || "sonstiges");

  function submit(e) {
    e.preventDefault();
    onSave({
      deadline: date || null,
      deadlineType: date ? type : null,
    });
  }

  return (
    <Modal onClose={onCancel}>
      <form onSubmit={submit} className="detail">
        <div className="detail-head">
          <div className="detail-title">
            {doc.deadline ? "Frist bearbeiten" : "Frist hinzufügen"}
          </div>
        </div>

        <div className="form-field">
          <label>Datum</label>
          <input
            type="date"
            className="form-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            autoFocus
          />
        </div>

        <div className="form-field">
          <label>Typ</label>
          <select
            className="form-input"
            value={type}
            onChange={(e) => setType(e.target.value)}
            disabled={!date}
          >
            {DEADLINE_TYPES.map((t) => (
              <option key={t} value={t}>
                {DEADLINE_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Abbrechen
          </button>
          <button type="submit" className="btn-primary btn-primary-block">
            Speichern
          </button>
        </div>
      </form>
    </Modal>
  );
}
