import Modal from "../components/Modal.jsx";

export default function MigrationPromptModal({ counts, onConfirm, onSkip, busy }) {
  return (
    <Modal onClose={busy ? undefined : onSkip} dismissable={!busy}>
      <div className="detail">
        <div className="detail-head">
          <div className="detail-title">Lokale Daten übernehmen?</div>
        </div>
        <p className="detail-text">
          Auf diesem Gerät finden wir noch Einträge aus der Zeit vor der
          Anmeldung. Sollen wir sie in dein Konto übertragen?
        </p>
        <ul className="migration-list">
          {counts.docs > 0 && <li>{counts.docs} Dokument{counts.docs === 1 ? "" : "e"}</li>}
          {counts.contacts > 0 && <li>{counts.contacts} Kontakt{counts.contacts === 1 ? "" : "e"}</li>}
          {counts.reminders > 0 && <li>{counts.reminders} Erinnerung{counts.reminders === 1 ? "" : "en"}</li>}
          {counts.events > 0 && <li>{counts.events} Termin{counts.events === 1 ? "" : "e"}</li>}
        </ul>
        <p className="detail-muted">
          Nach der Übertragung werden die lokalen Kopien gelöscht.
        </p>
        <div className="detail-actions detail-actions-row">
          <button
            type="button"
            className="btn-secondary"
            onClick={onSkip}
            disabled={busy}
          >
            Überspringen
          </button>
          <button
            type="button"
            className="btn-primary btn-primary-block"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Übertrage…" : "Ins Konto übertragen"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
