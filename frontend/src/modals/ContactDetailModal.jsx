import Modal from "../components/Modal.jsx";
import { formatDate } from "../utils/format.js";
import { getDocsForContact } from "../utils/insights.js";

export default function ContactDetailModal({ contact, docs, onEdit, onDelete, onClose }) {
  const linkedDocs = getDocsForContact(docs, contact);

  const fields = [
    { label: "IBAN", value: contact.iban },
    { label: "BIC", value: contact.bic },
    { label: "E-Mail", value: contact.email },
    { label: "Telefon", value: contact.phone },
  ];

  const addressLines = [
    contact.street,
    [contact.zip, contact.city].filter(Boolean).join(" "),
  ].filter(Boolean);

  return (
    <Modal onClose={onClose}>
      <div className="detail">
        <div className="detail-head">
          <div className="detail-title">{contact.name}</div>
          <div className="detail-badges">
            <span className="badge badge-neutral">{contact.type}</span>
          </div>
        </div>

        {fields.some((f) => f.value) && (
          <section className="detail-section">
            <h3 className="detail-heading">Kontaktdaten</h3>
            <dl className="kv-list">
              {fields.map(
                (f) =>
                  f.value && (
                    <div key={f.label} className="kv-row">
                      <dt>{f.label}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  )
              )}
            </dl>
          </section>
        )}

        {addressLines.length > 0 && (
          <section className="detail-section">
            <h3 className="detail-heading">Adresse</h3>
            <div className="detail-text">
              {addressLines.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          </section>
        )}

        {contact.notes && (
          <section className="detail-section">
            <h3 className="detail-heading">Notizen</h3>
            <p className="detail-text">{contact.notes}</p>
          </section>
        )}

        <section className="detail-section">
          <h3 className="detail-heading">
            Verknüpfte Dokumente ({linkedDocs.length})
          </h3>
          {linkedDocs.length === 0 ? (
            <p className="detail-text detail-muted">
              Keine Dokumente von diesem Absender.
            </p>
          ) : (
            <div className="linked-list">
              {linkedDocs.map((d) => (
                <div key={d.id} className="linked-item">
                  <div className="linked-title">{d.title}</div>
                  <div className="linked-meta">
                    {formatDate(d.date)}
                    {d.deadline && ` · Frist ${formatDate(d.deadline)}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="detail-actions detail-actions-row">
          <button
            type="button"
            className="btn-secondary"
            onClick={onDelete}
          >
            Löschen
          </button>
          <button type="button" className="btn-primary" onClick={onEdit}>
            Bearbeiten
          </button>
        </div>
      </div>
    </Modal>
  );
}
