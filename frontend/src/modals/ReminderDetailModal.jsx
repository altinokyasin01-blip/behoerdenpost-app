import Modal from "../components/Modal.jsx";
import { daysUntil, deadlineLevel, formatDate } from "../utils/format.js";

export default function ReminderDetailModal({
  reminder,
  doc,
  onEdit,
  onDelete,
  onToggleDone,
  onOpenDoc,
  onExportToCalendar,
  onClose,
}) {
  const days = daysUntil(reminder.date);
  const level = reminder.done ? "gray" : deadlineLevel(days);
  const daysBefore = reminder.daysBefore ?? 0;

  return (
    <Modal onClose={onClose}>
      <div className="detail">
        <div className="detail-head">
          <div className="detail-title">{reminder.title}</div>
          <div className="detail-badges">
            <span className={`badge badge-${reminder.done ? "green" : "gray"}`}>
              {reminder.done ? "Erledigt" : "Offen"}
            </span>
          </div>
        </div>

        <div className={`detail-deadline detail-deadline-${level}`}>
          <div className="detail-deadline-label">Termin</div>
          <div className="detail-deadline-date">{formatDate(reminder.date)}</div>
          <div className={`detail-deadline-days days-${level}`}>
            {reminder.done
              ? "erledigt"
              : days > 0
              ? `in ${days} Tag${days === 1 ? "" : "en"}`
              : days === 0
              ? "heute"
              : `${Math.abs(days)} Tag${Math.abs(days) === 1 ? "" : "e"} überfällig`}
          </div>
        </div>

        <section className="detail-section">
          <h3 className="detail-heading">Erinnerung</h3>
          <p className="detail-text">
            {daysBefore === 0
              ? "Benachrichtigung am Terminstag."
              : `Benachrichtigung ${daysBefore} Tag${daysBefore === 1 ? "" : "e"} vorher.`}
          </p>
        </section>

        {reminder.notes && (
          <section className="detail-section">
            <h3 className="detail-heading">Notiz</h3>
            <p className="detail-text">{reminder.notes}</p>
          </section>
        )}

        <section className="detail-section">
          <h3 className="detail-heading">Verknüpftes Dokument</h3>
          {doc ? (
            <button
              type="button"
              className="linked-item linked-clickable"
              onClick={() => onOpenDoc(doc.id)}
            >
              <div className="linked-title">{doc.title}</div>
              <div className="linked-meta">
                {doc.sender} · {formatDate(doc.date)}
              </div>
            </button>
          ) : reminder.orphaned ? (
            <p className="detail-text detail-muted">
              Dokument wurde gelöscht.
            </p>
          ) : (
            <p className="detail-text detail-muted">
              Nicht verknüpft.
            </p>
          )}
        </section>

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
          <button type="button" className="btn-secondary" onClick={onToggleDone}>
            {reminder.done ? "Als offen markieren" : "Erledigt markieren"}
          </button>
          <button type="button" className="btn-primary" onClick={onEdit}>
            Bearbeiten
          </button>
        </div>
      </div>
    </Modal>
  );
}
