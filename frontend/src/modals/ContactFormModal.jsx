import { useState } from "react";
import Modal from "../components/Modal.jsx";
import { CONTACT_TYPES } from "../utils/domainConstants.js";

const CONTACT_DEFAULTS = {
  name: "",
  type: "Sonstiges",
  iban: "",
  bic: "",
  email: "",
  phone: "",
  street: "",
  zip: "",
  city: "",
  notes: "",
};

export default function ContactFormModal({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    ...CONTACT_DEFAULTS,
    ...(initial || {}),
  }));
  const [error, setError] = useState(null);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name ist ein Pflichtfeld.");
      return;
    }
    onSave({ ...form, name: form.name.trim() });
  }

  return (
    <Modal onClose={onCancel}>
      <form onSubmit={submit} className="detail">
        <div className="detail-head">
          <div className="detail-title">
            {initial ? "Kontakt bearbeiten" : "Kontakt hinzufügen"}
          </div>
        </div>

        <div className="form-field">
          <label>Name *</label>
          <input
            type="text"
            className="form-input"
            value={form.name}
            onChange={(e) => {
              set("name", e.target.value);
              setError(null);
            }}
            autoFocus
          />
        </div>

        <div className="form-field">
          <label>Typ</label>
          <select
            className="form-input"
            value={form.type}
            onChange={(e) => set("type", e.target.value)}
          >
            {CONTACT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="form-grid">
          <div className="form-field">
            <label>IBAN</label>
            <input
              type="text"
              className="form-input"
              value={form.iban}
              onChange={(e) => set("iban", e.target.value)}
              placeholder="DE00 0000 0000 0000 0000 00"
            />
          </div>
          <div className="form-field">
            <label>BIC</label>
            <input
              type="text"
              className="form-input"
              value={form.bic}
              onChange={(e) => set("bic", e.target.value)}
            />
          </div>
        </div>

        <div className="form-grid">
          <div className="form-field">
            <label>E-Mail</label>
            <input
              type="email"
              className="form-input"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Telefon</label>
            <input
              type="tel"
              className="form-input"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
        </div>

        <div className="form-field">
          <label>Straße</label>
          <input
            type="text"
            className="form-input"
            value={form.street}
            onChange={(e) => set("street", e.target.value)}
          />
        </div>

        <div className="form-grid form-grid-zip">
          <div className="form-field">
            <label>PLZ</label>
            <input
              type="text"
              className="form-input"
              value={form.zip}
              onChange={(e) => set("zip", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Ort</label>
            <input
              type="text"
              className="form-input"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </div>
        </div>

        <div className="form-field">
          <label>Notizen</label>
          <textarea
            className="form-input form-textarea"
            rows={3}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>

        {error && <div className="onboarding-error">{error}</div>}

        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
          >
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
