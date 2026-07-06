import { useState } from "react";
import Modal from "../components/Modal.jsx";
import GoogleSyncToggle from "../components/GoogleSyncToggle.jsx";

export default function EventFormModal({
  initial,
  contacts,
  googleConnected,
  googleAutoExport,
  onSave,
  onCancel,
}) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(() => ({
    title: "",
    date: "",
    time: "",
    contactId: null,
    notes: "",
    ...(initial || {}),
  }));
  const [syncToGoogle, setSyncToGoogle] = useState(
    !isEdit && googleConnected && googleAutoExport
  );
  const [error, setError] = useState(null);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
  }

  function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Titel ist ein Pflichtfeld.");
      return;
    }
    if (!form.date) {
      setError("Datum ist ein Pflichtfeld.");
      return;
    }
    onSave({
      ...form,
      title: form.title.trim(),
      time: form.time || "",
      notes: form.notes ? form.notes.trim() : "",
      syncToGoogle: googleConnected && syncToGoogle,
    });
  }

  return (
    <Modal onClose={onCancel}>
      <form onSubmit={submit} className="detail">
        <div className="detail-head">
          <div className="detail-title">
            {initial ? "Termin bearbeiten" : "Termin hinzufügen"}
          </div>
        </div>

        <div className="form-field">
          <label>Titel *</label>
          <input
            type="text"
            className="form-input"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            autoFocus
          />
        </div>

        <div className="form-grid">
          <div className="form-field">
            <label>Datum *</label>
            <input
              type="date"
              className="form-input"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Uhrzeit</label>
            <input
              type="time"
              className="form-input"
              value={form.time || ""}
              onChange={(e) => set("time", e.target.value)}
            />
          </div>
        </div>

        <div className="form-field">
          <label>Verknüpfter Kontakt</label>
          <select
            className="form-input"
            value={form.contactId || ""}
            onChange={(e) => set("contactId", e.target.value || null)}
          >
            <option value="">— Kein Kontakt —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>Notizen</label>
          <textarea
            className="form-input form-textarea"
            rows={3}
            value={form.notes || ""}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>

        {googleConnected && !isEdit && (
          <GoogleSyncToggle
            checked={syncToGoogle}
            onChange={setSyncToGoogle}
          />
        )}

        {error && <div className="onboarding-error">{error}</div>}

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
