import { useState } from "react";
import Modal from "../components/Modal.jsx";
import { TEMPLATE_TYPES } from "../utils/domainConstants.js";

export default function TemplateFormModal({
  templateType,
  contacts,
  docs,
  defaultSenderName,
  onSubmit,
  onCancel,
  billingStatus,
}) {
  const tpl = TEMPLATE_TYPES.find((t) => t.id === templateType);
  const [form, setForm] = useState({
    context: "",
    recipientId: "",
    linkedDocId: "",
    senderName: defaultSenderName || "",
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.context.trim()) {
      setError("Beschreibe kurz deinen Kontext.");
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        templateType,
        context: form.context.trim(),
        senderName: form.senderName.trim(),
        recipient: form.recipientId
          ? contacts.find((c) => c.id === form.recipientId) || null
          : null,
        linkedDoc: form.linkedDocId
          ? docs.find((d) => d.id === form.linkedDocId) || null
          : null,
      });
    } catch (e2) {
      setError(e2.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={loading ? undefined : onCancel} dismissable={!loading}>
      <form onSubmit={submit} className="detail">
        <div className="detail-head">
          <div className="detail-title">{tpl?.label || "Vorlage"}</div>
          <div className="detail-sender">{tpl?.desc}</div>
          {billingStatus?.tier === "basic" && (
            <p className="detail-muted">
              {billingStatus.credits > 0
                ? `Vorlagen sind bei Basic nicht gratis — noch ${billingStatus.credits} Credits übrig.`
                : "Vorlagen sind bei Basic nicht im Gratis-Kontingent enthalten."}
            </p>
          )}
        </div>

        <div className="form-field">
          <label>Worum geht es? *</label>
          <textarea
            className="form-input form-textarea"
            rows={4}
            value={form.context}
            onChange={(e) => set("context", e.target.value)}
            placeholder="z.B. „Kündigung Mobilfunkvertrag zum nächstmöglichen Termin, Kundennr. 12345…"
            autoFocus
          />
        </div>

        <div className="form-field">
          <label>Empfänger (aus Kontakten)</label>
          <select
            className="form-input"
            value={form.recipientId}
            onChange={(e) => set("recipientId", e.target.value)}
          >
            <option value="">— Nicht verknüpfen —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>Bezug auf Dokument</label>
          <select
            className="form-input"
            value={form.linkedDocId}
            onChange={(e) => set("linkedDocId", e.target.value)}
          >
            <option value="">— Kein Bezug —</option>
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>Absender-Name (dein Name)</label>
          <input
            type="text"
            className="form-input"
            value={form.senderName}
            onChange={(e) => set("senderName", e.target.value)}
            placeholder="Max Mustermann"
          />
        </div>

        {error && <div className="onboarding-error">{error}</div>}

        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Abbrechen
          </button>
          <button
            type="submit"
            className="btn-primary btn-primary-block"
            disabled={loading}
          >
            {loading ? "Claude schreibt…" : "Anschreiben erzeugen"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
