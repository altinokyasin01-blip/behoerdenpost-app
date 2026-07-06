import { useState } from "react";
import Modal from "../components/Modal.jsx";
import GoogleSyncToggle from "../components/GoogleSyncToggle.jsx";
import {
  DEADLINE_TYPES,
  DEADLINE_TYPE_LABEL,
  DOC_CATEGORIES,
} from "../utils/domainConstants.js";

export default function ManualDeadlineFormModal({
  googleConnected,
  googleAutoExport,
  onSave,
  onCancel,
}) {
  const [form, setForm] = useState({
    title: "",
    sender: "",
    deadline: "",
    deadlineType: "sonstiges",
    amount: "",
    category: "Sonstiges",
    notes: "",
  });
  const [syncToGoogle, setSyncToGoogle] = useState(
    googleConnected && googleAutoExport
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
    if (!form.deadline) {
      setError("Frist-Datum ist ein Pflichtfeld.");
      return;
    }
    const raw = form.amount.trim().replace(/[€\s]/g, "").replace(",", ".");
    const amount = raw ? Number(raw) : null;
    if (raw && !Number.isFinite(amount)) {
      setError("Betrag ist keine gültige Zahl.");
      return;
    }
    onSave({
      title: form.title.trim(),
      sender: form.sender.trim(),
      deadline: form.deadline,
      deadlineType: form.deadlineType,
      amount: amount,
      category: form.category,
      notes: form.notes.trim(),
      syncToGoogle: googleConnected && syncToGoogle,
    });
  }

  return (
    <Modal onClose={onCancel}>
      <form onSubmit={submit} className="detail">
        <div className="detail-head">
          <div className="detail-title">Frist hinzufügen</div>
        </div>

        <div className="form-field">
          <label>Titel *</label>
          <input
            type="text"
            className="form-input"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="z.B. Steuererklärung 2025"
            autoFocus
          />
        </div>

        <div className="form-field">
          <label>Absender / Für wen</label>
          <input
            type="text"
            className="form-input"
            value={form.sender}
            onChange={(e) => set("sender", e.target.value)}
            placeholder="z.B. Finanzamt München"
          />
        </div>

        <div className="form-grid">
          <div className="form-field">
            <label>Frist *</label>
            <input
              type="date"
              className="form-input"
              value={form.deadline}
              onChange={(e) => set("deadline", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Typ</label>
            <select
              className="form-input"
              value={form.deadlineType}
              onChange={(e) => set("deadlineType", e.target.value)}
            >
              {DEADLINE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DEADLINE_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-grid">
          <div className="form-field">
            <label>Betrag (EUR)</label>
            <input
              type="text"
              inputMode="decimal"
              className="form-input"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              placeholder="z.B. 230,50"
            />
          </div>
          <div className="form-field">
            <label>Kategorie</label>
            <select
              className="form-input"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {DOC_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
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

        {googleConnected && (
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
