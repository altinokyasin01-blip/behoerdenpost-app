import Modal from "../components/Modal.jsx";
import { formatDate } from "../utils/format.js";

export default function EventDetailModal({
  event,
  contact,
  onEdit,
  onDelete,
  onExportToCalendar,
  onClose,
}) {
  return (
    <Modal onClose={onClose}>
      <div className="detail">
        <div className="detail-head">
          <div className="detail-title">{event.title}</div>
          <div className="detail-sender">
            {formatDate(event.date)}
            {event.time && ` · ${event.time}`}
          </div>
        </div>

        {(contact || event.orphaned) && (
          <section className="detail-section">
            <h3 className="detail-heading">Kontakt</h3>
            {contact ? (
              <div className="detail-text">{contact.name}</div>
            ) : (
              <p className="detail-text detail-muted">
                Kontakt wurde gelöscht.
              </p>
            )}
          </section>
        )}

        {event.notes && (
          <section className="detail-section">
            <h3 className="detail-heading">Notizen</h3>
            <p className="detail-text">{event.notes}</p>
          </section>
        )}

        <button
          type="button"
          className="btn-secondary btn-primary-block"
          onClick={onExportToCalendar}
        >
          Zu Kalender hinzufügen
        </button>

        <div className="detail-actions detail-actions-row">
          <button type="button" className="btn-secondary" onClick={onDelete}>
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
