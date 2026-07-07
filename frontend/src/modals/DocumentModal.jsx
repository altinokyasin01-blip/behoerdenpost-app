import { useState } from "react";
import Modal from "../components/Modal.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import CategoryChip from "../components/CategoryChip.jsx";
import DeadlineTypeBadge from "../components/DeadlineTypeBadge.jsx";
import { daysUntil, deadlineLevel, formatDate } from "../utils/format.js";

export default function DocumentModal({
  doc,
  onClose,
  onToggleStatus,
  onSetStatus,
  onEditDeadline,
  onDelete,
  onExportToCalendar,
  existingCategories,
  onUpdateCategory,
}) {
  const [copied, setCopied] = useState(false);
  const [showMoreStatus, setShowMoreStatus] = useState(false);
  const days = doc.deadline ? daysUntil(doc.deadline) : null;
  const level = days !== null ? deadlineLevel(days) : null;

  // Collapses back after picking — the StatusBadge above already reflects
  // the new state immediately, no reason to keep the picker open.
  function handleSetStatus(value) {
    onSetStatus(value);
    setShowMoreStatus(false);
  }

  async function handleCopy() {
    if (!doc.replyDraft) return;
    try {
      await navigator.clipboard.writeText(doc.replyDraft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard permission denied — ignore
    }
  }

  const isDone = doc.status === "Erledigt";

  return (
    <Modal onClose={onClose}>
      <div className="detail">
        <div className="detail-head">
          <div className="detail-title">{doc.title}</div>
          <div className="detail-badges">
            <CategoryChip
              value={doc.category}
              existingCategories={existingCategories}
              onChange={(cat) => onUpdateCategory(doc.id, cat)}
            />
            <StatusBadge status={doc.status} />
          </div>
          <div className="detail-sender">
            {doc.sender} · {formatDate(doc.date)}
          </div>
        </div>

        {doc.deadline && (
          <div className={`detail-deadline detail-deadline-${level}`}>
            <div className="detail-deadline-label">
              Frist
              <DeadlineTypeBadge type={doc.deadlineType} />
            </div>
            <div className="detail-deadline-date">
              {formatDate(doc.deadline)}
            </div>
            <div className={`detail-deadline-days days-${level}`}>
              {days > 0
                ? `noch ${days} Tag${days === 1 ? "" : "e"}`
                : days === 0
                ? "heute fällig"
                : `${Math.abs(days)} Tag${Math.abs(days) === 1 ? "" : "e"} überfällig`}
            </div>
          </div>
        )}

        {doc.summary && (
          <section className="detail-section">
            <h3 className="detail-heading">Zusammenfassung</h3>
            <p className="detail-text">{doc.summary}</p>
          </section>
        )}

        {doc.qrCodes?.length > 0 && (
          <section className="detail-section">
            <h3 className="detail-heading">
              {doc.qrCodes.length === 1 ? "QR-Code" : `QR-Codes (${doc.qrCodes.length})`}
            </h3>
            <p className="detail-muted">
              Automatisch erkannt und ausgelesen — überholt eventuelle
              gegenteilige Angaben in der Zusammenfassung oben (Claude sieht
              das Muster, liest es aber nicht selbst aus).
            </p>
            {doc.qrCodes.map((content, i) => {
              const isUrl = /^https?:\/\//i.test(content.trim());
              const looksLikeGiroCode = content.startsWith("BCD");
              return (
                <div key={i} className="qr-code-entry">
                  {looksLikeGiroCode && (
                    <div className="detail-muted">Sieht aus wie ein GiroCode (SEPA-QR)</div>
                  )}
                  {isUrl ? (
                    <a href={content} target="_blank" rel="noopener noreferrer">
                      {content}
                    </a>
                  ) : (
                    <pre className="code-block">{content}</pre>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {doc.replyDraft && (
          <section className="detail-section">
            <div className="detail-heading-row">
              <h3 className="detail-heading">Antwortentwurf</h3>
              <button type="button" className="copy-btn" onClick={handleCopy}>
                {copied ? "Kopiert" : "Kopieren"}
              </button>
            </div>
            <pre className="code-block">{doc.replyDraft}</pre>
            <div className="reply-actions">
              <a
                className="btn-secondary"
                href={`mailto:?subject=${encodeURIComponent(
                  "Re: " + doc.title
                )}&body=${encodeURIComponent(doc.replyDraft)}`}
              >
                Antwort per E-Mail senden
              </a>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => window.print()}
              >
                Als PDF speichern
              </button>
            </div>
          </section>
        )}

        {doc.replyDraft && (
          <div className="print-area" aria-hidden="true">
            <h1>{doc.title}</h1>
            <div className="print-meta">
              {doc.sender} · {formatDate(doc.date)}
            </div>
            <h2>Antwortentwurf</h2>
            <pre>{doc.replyDraft}</pre>
          </div>
        )}

        <div className="detail-actions detail-actions-stack">
          <button
            type="button"
            className={`btn-status ${isDone ? "btn-status-reopen" : "btn-status-done"}`}
            onClick={onToggleStatus}
          >
            {isDone ? "Als offen markieren" : "Als erledigt markieren"}
          </button>
          <button
            type="button"
            className="copy-btn status-more-toggle"
            onClick={() => setShowMoreStatus((v) => !v)}
          >
            Weitere Status-Optionen {showMoreStatus ? "▲" : "▼"}
          </button>
          {showMoreStatus && (
            <div className="filter-pills">
              <button
                type="button"
                className={`pill status-pill ${doc.status === "Laufend" ? "active" : ""}`}
                onClick={() => handleSetStatus("Laufend")}
              >
                Laufend
              </button>
              <button
                type="button"
                className={`pill status-pill ${!doc.status ? "active" : ""}`}
                onClick={() => handleSetStatus(null)}
              >
                Kein Status
              </button>
            </div>
          )}
          {doc.deadline && (
            <button
              type="button"
              className="btn-secondary btn-primary-block"
              onClick={onExportToCalendar}
            >
              Zu Kalender hinzufügen
            </button>
          )}
          <div className="detail-actions-row">
            <button
              type="button"
              className="btn-secondary"
              onClick={onEditDeadline}
            >
              {doc.deadline ? "Frist bearbeiten" : "Frist hinzufügen"}
            </button>
            <button
              type="button"
              className="btn-secondary btn-danger"
              onClick={onDelete}
            >
              Löschen
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
