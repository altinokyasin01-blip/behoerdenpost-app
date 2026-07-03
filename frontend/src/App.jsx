import { useEffect, useMemo, useRef, useState } from "react";
import API_BASE from "./config.js";
import "./App.css";

const TODAY = new Date("2026-07-02T00:00:00");
const STORAGE_KEY = "behoerdenpost_docs";
const DISCLAIMER_KEY = "disclaimer_shown";
const ONBOARDING_KEY = "onboarding_done";
const EMAIL_KEY = "user_email";
const CONTACTS_KEY = "behoerdenpost_contacts";
const REMINDERS_KEY = "behoerdenpost_reminders";

const CONTACT_TYPES = [
  "Behörde",
  "Bank",
  "Vermieter",
  "Arzt",
  "Versicherung",
  "Sonstiges",
];

const CATEGORY_TO_CONTACT_TYPE = {
  Finanzamt: "Behörde",
  Krankenkasse: "Versicherung",
  Vermieter: "Vermieter",
  Inkasso: "Sonstiges",
  Versicherung: "Versicherung",
  Sonstiges: "Sonstiges",
};

const DEADLINE_TYPES = ["zahlung", "antwort", "widerspruch", "abgabe", "sonstiges"];
const DEADLINE_TYPE_LABEL = {
  zahlung: "Zahlung",
  antwort: "Antwort",
  widerspruch: "Widerspruch",
  abgabe: "Abgabe",
  sonstiges: "Sonstiges",
};

const REMINDER_DAYS_BEFORE_OPTIONS = [0, 1, 3, 7];

function addDays(iso, delta) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function todayIso() {
  return TODAY.toISOString().slice(0, 10);
}

function formatAmount(v) {
  if (v == null || v === "") return "";
  if (typeof v === "string") return v;
  return v.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || "");
}

function sendDeadlineReminders(docs, reminders = []) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  const today = TODAY.toISOString().slice(0, 10);
  for (const d of docs) {
    if (d.status === "Erledigt" || !d.deadline) continue;
    const days = daysUntil(d.deadline);
    if (days > 3) continue;
    const key = `notified_${d.id}_${today}`;
    try {
      if (localStorage.getItem(key)) continue;
      new Notification("Frist läuft ab", {
        body: `${d.title} — noch ${days} Tag${days === 1 ? "" : "e"}`,
      });
      localStorage.setItem(key, "1");
    } catch {
      // ignore per-doc failures
    }
  }
  for (const r of reminders) {
    if (r.done || !r.date) continue;
    const days = daysUntil(r.date);
    const daysBefore = r.daysBefore ?? 0;
    if (days > daysBefore) continue;
    const key = `notified_${r.id}_${today}`;
    try {
      if (localStorage.getItem(key)) continue;
      new Notification("Erinnerung", {
        body: `${r.title} — ${
          days > 0
            ? `in ${days} Tag${days === 1 ? "" : "en"}`
            : days === 0
            ? "heute"
            : "überfällig"
        }`,
      });
      localStorage.setItem(key, "1");
    } catch {
      // ignore per-reminder failures
    }
  }
}

const svgProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function IconHome({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconScan({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  );
}

function IconGrid({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function IconArchive({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

function IconCamera({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function IconUpload({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function IconSearch({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconChevron({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IconUser({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconContacts({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

const CATEGORY_SYMBOLS = {
  Finanzamt: "§",
  Krankenkasse: "+",
  Vermieter: "⌂",
  Inkasso: "!",
  Versicherung: "◆",
  Sonstiges: "…",
};

function categorySymbol(name) {
  return CATEGORY_SYMBOLS[name] || name.charAt(0).toUpperCase();
}

const NAV_ITEMS = [
  { id: "home", label: "Home", Icon: IconHome },
  { id: "scan", label: "Scan", Icon: IconScan },
  { id: "categories", label: "Kategorien", Icon: IconGrid },
  { id: "contacts", label: "Kontakte", Icon: IconContacts },
  { id: "archive", label: "Archiv", Icon: IconArchive },
];

const INITIAL_DOCS = [];

function daysUntil(iso) {
  const d = new Date(iso + "T00:00:00");
  return Math.ceil((d - TODAY) / 86400000);
}

function deadlineLevel(days) {
  if (days < 7) return "red";
  if (days < 14) return "amber";
  return "green";
}

function progressPct(days) {
  const pct = ((30 - days) / 30) * 100;
  return Math.max(4, Math.min(100, pct));
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("de-DE");
}

function StatusBadge({ status }) {
  const map = { Offen: "red", Pending: "amber", Erledigt: "green" };
  return (
    <span className={`badge badge-${map[status] || "gray"}`}>{status}</span>
  );
}

function Modal({ onClose, children, dismissable = true }) {
  useEffect(() => {
    if (!dismissable) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, dismissable]);

  return (
    <div
      className="modal-overlay"
      onClick={dismissable ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        {dismissable && (
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Schließen"
          >
            ×
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

function DocumentModal({
  doc,
  onClose,
  onToggleStatus,
  onEditDeadline,
  onDelete,
}) {
  const [copied, setCopied] = useState(false);
  const days = doc.deadline ? daysUntil(doc.deadline) : null;
  const level = days !== null ? deadlineLevel(days) : null;

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
            <span className="badge badge-neutral">{doc.category}</span>
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

const ACTION_TYPE_LABEL = {
  contact: "Kontakt",
  reminder: "Erinnerung",
  amount: "Betrag",
  deadline: "Frist",
  note: "Notiz",
};

function formatActionValue(action) {
  if (action.value == null || action.value === "") return "";
  if (action.type === "amount") {
    const n = typeof action.value === "number" ? action.value : Number(action.value);
    return Number.isFinite(n) ? formatAmount(n) : String(action.value);
  }
  if (action.type === "deadline" || action.type === "reminder") {
    return formatDate(action.value);
  }
  return String(action.value);
}

function PostScanModal({ result, onConfirm, onSkip }) {
  const actions = Array.isArray(result.actions) ? result.actions : [];

  const [enabled, setEnabled] = useState(() => {
    const map = {};
    actions.forEach((a, i) => {
      map[i] = a.priority !== "low";
    });
    return map;
  });

  function toggle(i) {
    setEnabled((prev) => ({ ...prev, [i]: !prev[i] }));
  }

  function handleConfirm() {
    onConfirm(actions.filter((_, i) => enabled[i]));
  }

  return (
    <Modal onClose={onSkip}>
      <div className="detail">
        <div className="detail-head">
          <div className="detail-title">
            Erkannt: {result.documentType || "Dokument"}
          </div>
          {result.category && (
            <div className="detail-badges">
              <span className="badge badge-neutral">{result.category}</span>
              {result.sender && (
                <span className="detail-sender">{result.sender}</span>
              )}
            </div>
          )}
          {result.summary && (
            <div className="postscan-summary">{result.summary}</div>
          )}
        </div>

        <h3 className="detail-heading">Vorgeschlagene Aktionen</h3>
        <div className="action-list">
          {actions.length === 0 && (
            <div className="empty">
              Keine zusätzlichen Aktionen vorgeschlagen — Dokument wird gespeichert.
            </div>
          )}
          {actions.map((a, i) => {
            const displayValue = formatActionValue(a);
            const isOn = !!enabled[i];
            return (
              <label
                key={i}
                className={`action-item priority-${a.priority} ${isOn ? "on" : ""}`}
              >
                <input
                  type="checkbox"
                  className="action-check"
                  checked={isOn}
                  onChange={() => toggle(i)}
                />
                <div className="action-body">
                  <div className="action-row">
                    <span className={`action-tag tag-${a.type}`}>
                      {ACTION_TYPE_LABEL[a.type] || a.type}
                    </span>
                    <span className={`priority-dot priority-${a.priority}`} />
                  </div>
                  <div className="action-title">{a.label}</div>
                  {displayValue && (
                    <div className="action-desc">{displayValue}</div>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        <div className="detail-actions detail-actions-row">
          <button type="button" className="btn-secondary" onClick={onSkip}>
            Überspringen
          </button>
          <button
            type="button"
            className="btn-primary btn-primary-block"
            onClick={handleConfirm}
          >
            Übernehmen
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DeadlineTypeBadge({ type }) {
  if (!type) return null;
  return (
    <span className={`deadline-type-badge deadline-type-${type}`}>
      {DEADLINE_TYPE_LABEL[type] || type}
    </span>
  );
}

function CardMenu({ items, ariaLabel = "Menü" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="card-menu" ref={ref}>
      <button
        type="button"
        className="card-menu-btn"
        aria-label={ariaLabel}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        ⋯
      </button>
      {open && (
        <div className="card-menu-popup">
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              className="card-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                it.onClick();
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DeadlineEditModal({ doc, onSave, onCancel }) {
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

function ReminderFormModal({ initial, docs, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    title: "",
    date: "",
    docId: null,
    daysBefore: 3,
    notes: "",
    ...(initial || {}),
  }));
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
      notes: form.notes ? form.notes.trim() : "",
    });
  }

  return (
    <Modal onClose={onCancel}>
      <form onSubmit={submit} className="detail">
        <div className="detail-head">
          <div className="detail-title">
            {initial ? "Erinnerung bearbeiten" : "Erinnerung hinzufügen"}
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
          <label>Verknüpftes Dokument</label>
          <select
            className="form-input"
            value={form.docId || ""}
            onChange={(e) => set("docId", e.target.value || null)}
          >
            <option value="">— Kein Dokument —</option>
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>Erinnerung vorher</label>
          <div className="filter-pills">
            {REMINDER_DAYS_BEFORE_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                className={`pill ${form.daysBefore === n ? "active" : ""}`}
                onClick={() => set("daysBefore", n)}
              >
                {n === 0 ? "am Tag" : `${n} Tag${n === 1 ? "" : "e"} vorher`}
              </button>
            ))}
          </div>
        </div>

        <div className="form-field">
          <label>Notiz</label>
          <textarea
            className="form-input form-textarea"
            rows={3}
            value={form.notes || ""}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>

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

function ReminderDetailModal({
  reminder,
  doc,
  onEdit,
  onDelete,
  onToggleDone,
  onOpenDoc,
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

function AppealModal({
  doc,
  apiBase,
  onClose,
  onScheduleReminder,
  onShowReplyDraft,
}) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch(`${apiBase}/api/appeal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentType: doc.title,
            summary: doc.summary,
            deadlineType: doc.deadlineType,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) setAnalysis(data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const days = doc.deadline ? daysUntil(doc.deadline) : null;
  const worthwhile = analysis ? analysis.worthwhile !== false : true;

  return (
    <Modal onClose={onClose}>
      <div className="detail">
        <div className="detail-head">
          <div className="detail-title">Möchtest du Widerspruch einlegen?</div>
          {doc.deadline && (
            <div className="detail-sender">
              Frist {formatDate(doc.deadline)}
              {days != null && (
                <>
                  {" · "}
                  {days > 0
                    ? `noch ${days} Tag${days === 1 ? "" : "e"}`
                    : days === 0
                    ? "heute fällig"
                    : "überfällig"}
                </>
              )}
            </div>
          )}
        </div>

        {loading && (
          <div className="appeal-loading">
            <div className="loading-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div>Claude prüft die Erfolgsaussicht…</div>
          </div>
        )}

        {error && (
          <div className="alert">
            Einschätzung konnte nicht geladen werden ({error}).
          </div>
        )}

        {analysis && (
          <section className="detail-section appeal-analysis">
            <p className="detail-text">{analysis.reasoning}</p>
            <div className="appeal-chance-row">
              <span className="appeal-chance-label">Erfolgsaussicht</span>
              <span className={`appeal-badge appeal-badge-${analysis.successChance}`}>
                {analysis.successChance}
              </span>
            </div>
            {analysis.tip && (
              <div className="appeal-tip">{analysis.tip}</div>
            )}
          </section>
        )}

        <div className="appeal-actions">
          {!loading && !error && !worthwhile && (
            <div className="appeal-warning">Trotzdem widersprechen?</div>
          )}
          <button
            type="button"
            className={`btn-secondary ${!loading && !worthwhile ? "btn-dimmed" : ""}`}
            onClick={onScheduleReminder}
            disabled={loading}
          >
            Ja, erinnere mich früher
          </button>
          <button
            type="button"
            className={`btn-secondary ${!loading && !worthwhile ? "btn-dimmed" : ""}`}
            onClick={onShowReplyDraft}
            disabled={loading || !doc.replyDraft}
          >
            Antwortentwurf anzeigen
          </button>
        </div>

        <div className="appeal-decision">Die Entscheidung liegt bei dir.</div>
        <div className="appeal-disclaimer">
          Einschätzung basiert auf KI, kein Rechtsrat.
        </div>
      </div>
    </Modal>
  );
}

function DisclaimerModal({ onAcknowledge }) {
  return (
    <Modal onClose={() => {}} dismissable={false}>
      <div className="disclaimer">
        <h2 className="disclaimer-title">Willkommen</h2>
        <p className="disclaimer-text">
          Behördenpost hilft dir, Behördenbriefe zu verstehen. Die App ersetzt
          keine Rechtsberatung. Bei komplexen Fällen wende dich an einen Anwalt
          oder Steuerberater.
        </p>
        <button
          type="button"
          className="btn-primary btn-primary-block"
          onClick={onAcknowledge}
        >
          Verstanden
        </button>
      </div>
    </Modal>
  );
}

function OnboardingScreen({ onDone }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem(EMAIL_KEY) || "";
    } catch {
      return "";
    }
  });
  const [emailError, setEmailError] = useState(null);

  function next() {
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!isValidEmail(email)) {
        setEmailError("Bitte gib eine gültige E-Mail-Adresse ein.");
        return;
      }
      try {
        localStorage.setItem(EMAIL_KEY, email);
      } catch {
        // ignore
      }
      setStep(3);
      return;
    }
    // step 3 — request notification permission, then finish
    try {
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "default"
      ) {
        Notification.requestPermission();
      }
    } catch {
      // ignore permission errors
    }
    onDone(email);
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="onboarding-stepper" aria-label={`Schritt ${step} von 3`}>
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`step-dot ${step >= n ? "active" : ""}`}
            />
          ))}
        </div>

        {step === 1 && (
          <>
            <h1 className="onboarding-title">Behördenpost-Assistent</h1>
            <p className="onboarding-text">
              Fotografiere Behördenbriefe, lass sie automatisch analysieren
              und behalte deine Fristen im Blick.
            </p>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="onboarding-title">Deine E-Mail-Adresse</h1>
            <p className="onboarding-text">
              Damit wir dich später an Fristen erinnern können.
            </p>
            <input
              type="email"
              className="onboarding-input"
              placeholder="max@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && next()}
              autoFocus
            />
            {emailError && (
              <div className="onboarding-error">{emailError}</div>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="onboarding-title">Alles bereit</h1>
            <p className="onboarding-text">
              Du kannst jetzt loslegen. Beim Öffnen fragen wir nach der
              Berechtigung für Fristerinnerungen im Browser.
            </p>
          </>
        )}

        <button
          type="button"
          className="btn-primary btn-primary-block"
          onClick={next}
        >
          {step === 3 ? "App öffnen" : "Weiter"}
        </button>
      </div>
    </div>
  );
}

function Sidebar({ active, onChange, userEmail }) {
  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-mark">B</div>
        <div className="logo-text">Behördenpost</div>
      </div>
      <nav className="nav-list">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`nav-item ${active === id ? "active" : ""}`}
            onClick={() => onChange(id)}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {userEmail && (
        <div className="sidebar-user" title={userEmail}>
          <div className="user-avatar">
            <IconUser />
          </div>
          <div className="user-email">{userEmail}</div>
        </div>
      )}
      <button
        type="button"
        className="dev-reset"
        onClick={() => {
          try {
            localStorage.clear();
          } catch {
            // ignore
          }
          location.reload();
        }}
      >
        Reset (Dev)
      </button>
    </aside>
  );
}

function BottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`bottom-nav-item ${active === id ? "active" : ""}`}
          onClick={() => onChange(id)}
        >
          <Icon size={22} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function HomeView({
  docs,
  reminders,
  onNav,
  onOpenDoc,
  onOpenReminder,
  onAddReminder,
  onToggleReminder,
  onToggleDocStatus,
  onEditDeadline,
  onOpenAppeal,
}) {
  const [deadlineFilter, setDeadlineFilter] = useState("all");

  const allOpenDeadlines = docs
    .filter((d) => d.deadline && d.status !== "Erledigt")
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  const openDeadlines = allOpenDeadlines.filter(
    (d) => deadlineFilter === "all" || (d.deadlineType || "sonstiges") === deadlineFilter
  );

  const openCount = docs.filter((d) => d.status === "Offen").length;
  const sortedReminders = [...(reminders || [])].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (a.date || "").localeCompare(b.date || "");
  });

  const deadlineFilters = [
    { id: "all", label: "Alle" },
    ...DEADLINE_TYPES.filter((t) => t !== "sonstiges").map((t) => ({
      id: t,
      label: DEADLINE_TYPE_LABEL[t],
    })),
  ];

  return (
    <div className="view">
      <header className="view-header">
        <h1>Guten Tag</h1>
        <p className="lead">
          Sie haben {openCount} unerledigte{openCount === 1 ? "n" : ""} Vorgang
          {openCount === 1 ? "" : "e"}.
        </p>
      </header>

      <section className="stats">
        <div className="stat">
          <div className="stat-value">{allOpenDeadlines.length}</div>
          <div className="stat-label">Offene Fristen</div>
        </div>
        <div className="stat">
          <div className="stat-value">{docs.length}</div>
          <div className="stat-label">Briefe gesamt</div>
        </div>
      </section>

      <h2 className="section-title">Anstehende Fristen</h2>
      <div className="filter-pills">
        {deadlineFilters.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`pill ${deadlineFilter === f.id ? "active" : ""}`}
            onClick={() => setDeadlineFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="deadline-list">
        {openDeadlines.length === 0 && (
          <div className="empty">Keine offenen Fristen.</div>
        )}
        {openDeadlines.map((d) => {
          const days = daysUntil(d.deadline);
          const level = deadlineLevel(days);
          const isAppealCase = d.deadlineType === "widerspruch";
          const appealPlanned =
            isAppealCase &&
            reminders.some(
              (r) => r.docId === d.id && r.kind === "appeal" && !r.done
            );
          return (
            <div key={d.id} className="card deadline-card">
              <button
                type="button"
                className="deadline-body"
                onClick={() => onOpenDoc(d.id)}
              >
                <div className="deadline-head">
                  <div className="deadline-info">
                    <div className="deadline-title-row">
                      <span className="deadline-title">{d.title}</span>
                      {appealPlanned ? (
                        <span className="appeal-planned-badge">
                          Widerspruch geplant
                        </span>
                      ) : (
                        <DeadlineTypeBadge type={d.deadlineType} />
                      )}
                    </div>
                    <div className="deadline-sender">{d.sender}</div>
                  </div>
                  <div className={`deadline-days days-${level}`}>
                    {days > 0
                      ? `noch ${days} Tag${days === 1 ? "" : "e"}`
                      : days === 0
                      ? "heute fällig"
                      : "überfällig"}
                  </div>
                </div>
                <div className="progress">
                  <div
                    className={`progress-bar bar-${level}`}
                    style={{ width: `${progressPct(days)}%` }}
                  />
                </div>
                <div className="deadline-foot">
                  Fällig am {formatDate(d.deadline)}
                  {d.amount != null && ` · ${formatAmount(d.amount)}`}
                </div>
              </button>
              {isAppealCase && !appealPlanned && (
                <div className="deadline-appeal-row">
                  <button
                    type="button"
                    className="appeal-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenAppeal(d.id);
                    }}
                  >
                    Widersprechen?
                  </button>
                </div>
              )}
              <CardMenu
                items={[
                  {
                    label: "Als erledigt markieren",
                    onClick: () => onToggleDocStatus(d.id),
                  },
                  {
                    label: "Frist verschieben",
                    onClick: () => onEditDeadline(d.id),
                  },
                ]}
              />
            </div>
          );
        })}
      </div>

      <div className="section-title-row">
        <h2 className="section-title section-title-inline">Erinnerungen</h2>
        <button
          type="button"
          className="btn-primary btn-primary-sm"
          onClick={onAddReminder}
        >
          + Erinnerung
        </button>
      </div>
      <div className="reminder-list">
        {sortedReminders.length === 0 && (
          <div className="empty">Keine Erinnerungen.</div>
        )}
        {sortedReminders.map((r) => {
          const days = daysUntil(r.date);
          const level = r.done ? "gray" : deadlineLevel(days);
          return (
            <div
              key={r.id}
              className={`card reminder-card ${r.done ? "done" : ""}`}
            >
              <button
                type="button"
                className={`reminder-check ${r.done ? "checked" : ""}`}
                onClick={() => onToggleReminder(r.id)}
                aria-label={r.done ? "Als offen markieren" : "Als erledigt markieren"}
              >
                {r.done ? "✓" : ""}
              </button>
              <button
                type="button"
                className="reminder-body"
                onClick={() => onOpenReminder(r.id)}
              >
                <div className="reminder-title">{r.title}</div>
                <div className={`reminder-meta days-${level}`}>
                  {formatDate(r.date)}
                  {" · "}
                  {r.done
                    ? "erledigt"
                    : days > 0
                    ? `in ${days} Tag${days === 1 ? "" : "en"}`
                    : days === 0
                    ? "heute"
                    : `${Math.abs(days)} Tag${Math.abs(days) === 1 ? "" : "e"} überfällig`}
                </div>
                {r.orphaned && (
                  <div className="reminder-orphan">Dokument wurde gelöscht</div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <h2 className="section-title">Schnellaktion</h2>
      <button className="card action-card" onClick={() => onNav("scan")}>
        <div className="action-icon">
          <IconCamera size={22} />
        </div>
        <div className="action-text">
          <div className="action-title">Neuen Brief scannen</div>
          <div className="action-sub">Fotografieren oder Datei hochladen</div>
        </div>
        <IconChevron />
      </button>
    </div>
  );
}

function ScanView({ docs, onScanned, onOpenDoc }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("document", file);
      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const result = await res.json();
      onScanned({ ...result, filename: file.name });
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  return (
    <div className="view">
      <header className="view-header">
        <h1>Scannen</h1>
        <p className="lead">Dokument hochladen oder mit Kamera aufnehmen.</p>
      </header>

      <div
        className={`dropzone ${dragging ? "dragging" : ""} ${
          uploading ? "uploading" : ""
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <div className="dropzone-icon">
          <IconUpload />
        </div>
        <div className="dropzone-title">
          {uploading ? "Analysiere…" : "Datei hier ablegen oder wählen"}
        </div>
        <div className="dropzone-sub">PDF, JPG oder PNG · max. 15 MB</div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      <button
        className="camera-btn"
        onClick={() => cameraInputRef.current?.click()}
        disabled={uploading}
      >
        <IconCamera />
        <span>Foto aufnehmen</span>
      </button>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {error && <div className="alert">Fehler: {error}</div>}

      <h2 className="section-title">Scan-Verlauf</h2>
      <div className="doc-list">
        {docs.length === 0 && <div className="empty">Noch keine Scans.</div>}
        {docs.map((d) => (
          <button
            key={d.id}
            type="button"
            className="card doc-card"
            onClick={() => onOpenDoc(d.id)}
          >
            <div className="doc-body">
              <div className="doc-title">{d.title}</div>
              <div className="doc-meta">
                {d.sender} · {formatDate(d.date)}
              </div>
            </div>
            <StatusBadge status={d.status} />
          </button>
        ))}
      </div>
    </div>
  );
}

function CategoriesView({ docs, onOpenCategory, onNav }) {
  const groups = useMemo(() => {
    const map = new Map();
    for (const d of docs) {
      const cat = d.category || "Sonstiges";
      if (!map.has(cat)) map.set(cat, { total: 0, open: 0 });
      const g = map.get(cat);
      g.total += 1;
      if (d.status !== "Erledigt") g.open += 1;
    }
    return [...map.entries()]
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => b.open - a.open || b.total - a.total || a.name.localeCompare(b.name));
  }, [docs]);

  return (
    <div className="view">
      <header className="view-header">
        <h1>Kategorien</h1>
        <p className="lead">Deine Post nach Absender gruppiert.</p>
      </header>

      {groups.length === 0 ? (
        <div className="card empty-card">
          <div className="empty-title">Noch keine Briefe gescannt</div>
          <div className="empty-sub">
            Sobald du ein Dokument scannst, erscheinen hier automatisch die
            passenden Kategorien.
          </div>
          <button className="btn-primary" onClick={() => onNav("scan")}>
            <IconCamera size={18} />
            <span>Brief scannen</span>
          </button>
        </div>
      ) : (
        <div className="cat-grid">
          {groups.map((g) => (
            <button
              key={g.name}
              className="card cat-card"
              type="button"
              onClick={() => onOpenCategory(g.name)}
            >
              <div className="cat-symbol">{categorySymbol(g.name)}</div>
              <div className="cat-name">{g.name}</div>
              <div className="cat-meta">
                {g.total} Brief{g.total === 1 ? "" : "e"}
                {g.open > 0 && (
                  <>
                    {" · "}
                    <span className="text-red">{g.open} offen</span>
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <h2 className="section-title">Werkzeuge</h2>
      <div className="tool-grid">
        <button className="card tool-card" type="button">
          <div className="tool-title">Widerspruchsgenerator</div>
          <div className="tool-sub">
            Automatisch begründete Widersprüche verfassen
          </div>
        </button>
        <button className="card tool-card" type="button">
          <div className="tool-title">Fristen-Kalender</div>
          <div className="tool-sub">
            Alle Deadlines auf einen Blick, mit Erinnerungen
          </div>
        </button>
      </div>
    </div>
  );
}

const ARCHIVE_SORTS = {
  date_desc: (a, b) => (b.date || "").localeCompare(a.date || ""),
  date_asc: (a, b) => (a.date || "").localeCompare(b.date || ""),
  deadline_asc: (a, b) => {
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return a.deadline.localeCompare(b.deadline);
  },
  deadline_desc: (a, b) => {
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return b.deadline.localeCompare(a.deadline);
  },
};

function ArchiveView({ docs, categoryFilter, onClearCategoryFilter, onOpenDoc }) {
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("date_desc");
  const [search, setSearch] = useState("");

  const years = useMemo(
    () => [...new Set(docs.map((d) => d.date.slice(0, 4)))].sort().reverse(),
    [docs]
  );

  const filtered = docs
    .filter((d) => {
      if (categoryFilter && d.category !== categoryFilter) return false;
      if (filter === "open" && d.status === "Erledigt") return false;
      if (filter === "done" && d.status !== "Erledigt") return false;
      if (filter.startsWith("y-") && !d.date.startsWith(filter.slice(2)))
        return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = [d.title, d.sender, d.category, d.summary]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .sort(ARCHIVE_SORTS[sort] || ARCHIVE_SORTS.date_desc);

  const filters = [
    { id: "all", label: "Alle" },
    { id: "open", label: "Offen" },
    { id: "done", label: "Erledigt" },
    ...years.map((y) => ({ id: `y-${y}`, label: y })),
  ];

  return (
    <div className="view">
      <header className="view-header">
        <h1>Archiv</h1>
        <p className="lead">Alle Dokumente durchsuchen und filtern.</p>
      </header>

      <div className="search-box">
        <IconSearch />
        <input
          type="text"
          placeholder="Suchen nach Titel, Absender oder Inhalt…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {categoryFilter && (
        <button
          type="button"
          className="chip"
          onClick={onClearCategoryFilter}
          aria-label="Kategorie-Filter entfernen"
        >
          <span>Kategorie: {categoryFilter}</span>
          <span className="chip-x" aria-hidden="true">×</span>
        </button>
      )}

      <div className="filter-pills">
        {filters.map((f) => (
          <button
            key={f.id}
            className={`pill ${filter === f.id ? "active" : ""}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="sort-row">
        <label htmlFor="archive-sort" className="sort-label">
          Sortierung
        </label>
        <select
          id="archive-sort"
          className="form-input sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="date_desc">Datum (neueste zuerst)</option>
          <option value="date_asc">Datum (älteste zuerst)</option>
          <option value="deadline_asc">Frist (nächste zuerst)</option>
          <option value="deadline_desc">Frist (späteste zuerst)</option>
        </select>
      </div>

      <div className="doc-list">
        {filtered.length === 0 && (
          <div className="empty">Keine Dokumente gefunden.</div>
        )}
        {filtered.map((d) => (
          <button
            key={d.id}
            type="button"
            className="card doc-card"
            onClick={() => onOpenDoc(d.id)}
          >
            <div className="doc-body">
              <div className="doc-title-row">
                <span className="doc-title">{d.title}</span>
                <DeadlineTypeBadge type={d.deadlineType} />
              </div>
              <div className="doc-meta">
                {d.sender} · {formatDate(d.date)} · {d.category}
                {d.deadline && ` · Frist ${formatDate(d.deadline)}`}
              </div>
              {d.summary && <div className="doc-summary">{d.summary}</div>}
            </div>
            <StatusBadge status={d.status} />
          </button>
        ))}
      </div>
    </div>
  );
}

function contactTopInfo(c) {
  return c.iban || c.email || c.phone || "";
}

function ContactCard({ contact, onClick }) {
  const top = contactTopInfo(contact);
  return (
    <button type="button" className="card doc-card" onClick={onClick}>
      <div className="doc-body">
        <div className="doc-title">{contact.name}</div>
        {top && <div className="doc-meta">{top}</div>}
      </div>
      <span className="badge badge-neutral">{contact.type}</span>
    </button>
  );
}

function ContactsView({ contacts, onAdd, onOpenDetail }) {
  const [search, setSearch] = useState("");

  const filtered = contacts.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const hay = [c.name, c.iban, c.email, c.phone, c.street, c.zip, c.city]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  return (
    <div className="view">
      <header className="view-header">
        <div className="view-header-row">
          <div>
            <h1>Kontakte</h1>
            <p className="lead">
              Behörden, Banken, Vermieter — an einem Ort.
            </p>
          </div>
          {contacts.length > 0 && (
            <button
              type="button"
              className="btn-primary btn-primary-sm"
              onClick={onAdd}
            >
              + Kontakt
            </button>
          )}
        </div>
      </header>

      {contacts.length === 0 ? (
        <div className="card empty-card">
          <div className="empty-title">Noch keine Kontakte</div>
          <div className="empty-sub">
            Füge deinen ersten Kontakt hinzu — z.B. dein Finanzamt oder deine
            Krankenkasse.
          </div>
          <button type="button" className="btn-primary" onClick={onAdd}>
            Kontakt hinzufügen
          </button>
        </div>
      ) : (
        <>
          <div className="search-box">
            <IconSearch />
            <input
              type="text"
              placeholder="Suche in Name, IBAN, E-Mail, Telefon, Adresse…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="doc-list">
            {filtered.length === 0 && (
              <div className="empty">Keine Treffer.</div>
            )}
            {filtered.map((c) => (
              <ContactCard
                key={c.id}
                contact={c}
                onClick={() => onOpenDetail(c.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

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

function ContactFormModal({ initial, onSave, onCancel }) {
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

function ContactDetailModal({ contact, docs, onEdit, onDelete, onClose }) {
  const linkedDocs = docs.filter(
    (d) =>
      contact.name &&
      d.sender &&
      d.sender.toLowerCase().includes(contact.name.toLowerCase())
  );

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

function loadContacts() {
  try {
    const raw = localStorage.getItem(CONTACTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // corrupted / unavailable — fall through
  }
  return [];
}

function loadReminders() {
  try {
    const raw = localStorage.getItem(REMINDERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function loadDocs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // corrupted / unavailable — fall through
  }
  return INITIAL_DOCS;
}

function loadDisclaimerOpen() {
  try {
    return !localStorage.getItem(DISCLAIMER_KEY);
  } catch {
    return false;
  }
}

function loadOnboardingDone() {
  try {
    return !!localStorage.getItem(ONBOARDING_KEY);
  } catch {
    return true;
  }
}

function loadUserEmail() {
  try {
    return localStorage.getItem(EMAIL_KEY) || "";
  } catch {
    return "";
  }
}

export default function App() {
  const [tab, setTab] = useState("home");
  const [docs, setDocs] = useState(loadDocs);
  const [contacts, setContacts] = useState(loadContacts);
  const [reminders, setReminders] = useState(loadReminders);
  const [pendingResult, setPendingResult] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [contactFormMode, setContactFormMode] = useState("add");
  const [contactFormPrefill, setContactFormPrefill] = useState(null);
  const [selectedReminderId, setSelectedReminderId] = useState(null);
  const [reminderFormOpen, setReminderFormOpen] = useState(false);
  const [reminderFormMode, setReminderFormMode] = useState("add");
  const [reminderFormPrefill, setReminderFormPrefill] = useState(null);
  const [deadlineEditDocId, setDeadlineEditDocId] = useState(null);
  const [appealDocId, setAppealDocId] = useState(null);
  const [disclaimerOpen, setDisclaimerOpen] = useState(loadDisclaimerOpen);
  const [onboardingDone, setOnboardingDone] = useState(loadOnboardingDone);
  const [userEmail, setUserEmail] = useState(loadUserEmail);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
    } catch {
      // storage full / private mode — ignore
    }
  }, [docs]);

  useEffect(() => {
    try {
      localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
    } catch {
      // ignore
    }
  }, [contacts]);

  useEffect(() => {
    try {
      localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
    } catch {
      // ignore
    }
  }, [reminders]);

  useEffect(() => {
    if (!onboardingDone) return;
    sendDeadlineReminders(docs, reminders);
    // Only run when onboarding transitions to done (returning users on mount,
    // new users after they finish step 3). Docs snapshot at that moment is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingDone]);

  const selectedDoc = docs.find((d) => d.id === selectedId);

  function buildDocFromResult(result) {
    const today = TODAY.toISOString().slice(0, 10);
    const deadline = result.deadline || null;
    return {
      id: "d" + Date.now(),
      title: result.documentType || result.filename || "Dokument",
      sender: result.sender || "",
      category: result.category || "Sonstiges",
      date: today,
      deadline,
      deadlineType: deadline
        ? (DEADLINE_TYPES.includes(result.deadlineType)
            ? result.deadlineType
            : "sonstiges")
        : null,
      amount: result.amount ?? null,
      summary: result.summary || null,
      replyDraft: result.replyDraft || null,
      status: "Offen",
      notes: null,
      filename: result.filename || null,
    };
  }

  function handlePostScanConfirm(chosenActions) {
    if (!pendingResult) return;
    const doc = buildDocFromResult(pendingResult);
    const newReminders = [];
    const noteParts = [];
    let contactPrefill = null;

    for (const a of chosenActions) {
      if (!a.value) continue;
      if (a.type === "amount") {
        const n = typeof a.value === "number" ? a.value : Number(a.value);
        if (Number.isFinite(n)) doc.amount = n;
      } else if (a.type === "deadline") {
        doc.deadline = a.value;
      } else if (a.type === "note") {
        noteParts.push(String(a.value));
      } else if (a.type === "reminder") {
        newReminders.push({
          id: "r" + Date.now() + Math.random().toString(36).slice(2, 6),
          docId: doc.id,
          title: doc.title,
          date: a.value,
          done: false,
        });
      } else if (a.type === "contact" && !contactPrefill) {
        const name = String(a.value);
        const existing = contacts.find(
          (c) => c.name.toLowerCase() === name.toLowerCase()
        );
        if (!existing) {
          contactPrefill = {
            name,
            type: CATEGORY_TO_CONTACT_TYPE[doc.category] || "Sonstiges",
          };
        }
      }
    }

    if (noteParts.length) doc.notes = noteParts.join("\n\n");

    setDocs((prev) => [doc, ...prev]);
    if (newReminders.length) {
      setReminders((prev) => [...newReminders, ...prev]);
    }
    setPendingResult(null);

    if (contactPrefill) {
      setContactFormMode("add");
      setContactFormPrefill(contactPrefill);
      setContactFormOpen(true);
    }
  }

  function handlePostScanSkip() {
    if (!pendingResult) return;
    setDocs((prev) => [buildDocFromResult(pendingResult), ...prev]);
    setPendingResult(null);
  }

  function toggleReminder(id) {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, done: !r.done } : r))
    );
  }

  function toggleStatus(id) {
    setDocs((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, status: d.status === "Erledigt" ? "Offen" : "Erledigt" }
          : d
      )
    );
  }

  function deleteDoc(id) {
    const d = docs.find((x) => x.id === id);
    if (!d) return;
    if (!confirm(`Dokument "${d.title}" wirklich löschen?`)) return;
    setDocs((prev) => prev.filter((x) => x.id !== id));
    setReminders((prev) =>
      prev.map((r) =>
        r.docId === id ? { ...r, docId: null, orphaned: true } : r
      )
    );
    setSelectedId(null);
  }

  function openDeadlineEdit(id) {
    setDeadlineEditDocId(id);
  }

  function saveDeadlineEdit({ deadline, deadlineType }) {
    if (!deadlineEditDocId) return;
    setDocs((prev) =>
      prev.map((d) =>
        d.id === deadlineEditDocId ? { ...d, deadline, deadlineType } : d
      )
    );
    setDeadlineEditDocId(null);
  }

  function openAddReminder(prefill = null) {
    setReminderFormMode("add");
    setSelectedReminderId(null);
    setReminderFormPrefill(prefill);
    setReminderFormOpen(true);
  }

  function openEditReminder() {
    setReminderFormMode("edit");
    setReminderFormPrefill(null);
    setReminderFormOpen(true);
  }

  function closeReminderForm() {
    setReminderFormOpen(false);
    setReminderFormPrefill(null);
  }

  function saveReminder(data) {
    if (reminderFormMode === "edit" && selectedReminderId) {
      setReminders((prev) =>
        prev.map((r) =>
          r.id === selectedReminderId ? { ...r, ...data } : r
        )
      );
    } else {
      setReminders((prev) => [
        {
          id: "r" + Date.now(),
          done: false,
          ...data,
        },
        ...prev,
      ]);
    }
    closeReminderForm();
  }

  function openAppeal(docId) {
    setAppealDocId(docId);
  }

  function handleAppealScheduleReminder() {
    const d = docs.find((x) => x.id === appealDocId);
    if (!d) return;
    const targetDate = d.deadline
      ? addDays(d.deadline, -7)
      : todayIso();
    const finalDate =
      targetDate < todayIso() ? todayIso() : targetDate;
    setAppealDocId(null);
    openAddReminder({
      title: `Widerspruch vorbereiten: ${d.title}`,
      date: finalDate,
      docId: d.id,
      daysBefore: 3,
      kind: "appeal",
    });
  }

  function handleAppealShowReplyDraft() {
    const id = appealDocId;
    setAppealDocId(null);
    if (id) setSelectedId(id);
  }

  function deleteReminder() {
    if (!selectedReminderId) return;
    if (!confirm("Erinnerung wirklich löschen?")) return;
    setReminders((prev) => prev.filter((r) => r.id !== selectedReminderId));
    setSelectedReminderId(null);
  }

  function toggleSelectedReminderDone() {
    if (!selectedReminderId) return;
    toggleReminder(selectedReminderId);
  }

  function navigate(nextTab) {
    if (nextTab !== "archive") setCategoryFilter(null);
    setTab(nextTab);
  }

  function openCategory(name) {
    setCategoryFilter(name);
    setTab("archive");
  }

  function openAddContact() {
    setContactFormMode("add");
    setContactFormPrefill(null);
    setContactFormOpen(true);
  }

  function closeContactForm() {
    setContactFormOpen(false);
    setContactFormPrefill(null);
  }

  function saveContact(data) {
    if (contactFormMode === "edit" && selectedContactId) {
      setContacts((prev) =>
        prev.map((c) => (c.id === selectedContactId ? { ...c, ...data } : c))
      );
    } else {
      setContacts((prev) => [{ ...data, id: "c" + Date.now() }, ...prev]);
    }
    closeContactForm();
  }

  function deleteContact() {
    const c = contacts.find((x) => x.id === selectedContactId);
    if (!c) return;
    if (!confirm(`Kontakt "${c.name}" wirklich löschen?`)) return;
    setContacts((prev) => prev.filter((x) => x.id !== selectedContactId));
    setSelectedContactId(null);
  }

  function acknowledgeDisclaimer() {
    try {
      localStorage.setItem(DISCLAIMER_KEY, "1");
    } catch {
      // ignore
    }
    setDisclaimerOpen(false);
  }

  function completeOnboarding(email) {
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      // ignore
    }
    setUserEmail(email);
    setOnboardingDone(true);
  }

  if (!onboardingDone) {
    return (
      <div className="app">
        {!disclaimerOpen && (
          <OnboardingScreen onDone={completeOnboarding} />
        )}
        {disclaimerOpen && (
          <DisclaimerModal onAcknowledge={acknowledgeDisclaimer} />
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar active={tab} onChange={navigate} userEmail={userEmail} />
      <main className="main">
        {tab === "home" && (
          <HomeView
            docs={docs}
            reminders={reminders}
            onNav={navigate}
            onOpenDoc={setSelectedId}
            onOpenReminder={setSelectedReminderId}
            onAddReminder={() => openAddReminder()}
            onToggleReminder={toggleReminder}
            onToggleDocStatus={toggleStatus}
            onEditDeadline={openDeadlineEdit}
            onOpenAppeal={openAppeal}
          />
        )}
        {tab === "scan" && (
          <ScanView
            docs={docs}
            onScanned={setPendingResult}
            onOpenDoc={setSelectedId}
          />
        )}
        {tab === "categories" && (
          <CategoriesView
            docs={docs}
            onOpenCategory={openCategory}
            onNav={navigate}
          />
        )}
        {tab === "contacts" && (
          <ContactsView
            contacts={contacts}
            onAdd={openAddContact}
            onOpenDetail={setSelectedContactId}
          />
        )}
        {tab === "archive" && (
          <ArchiveView
            docs={docs}
            categoryFilter={categoryFilter}
            onClearCategoryFilter={() => setCategoryFilter(null)}
            onOpenDoc={setSelectedId}
          />
        )}
      </main>
      <BottomNav active={tab} onChange={navigate} />

      {selectedDoc && !deadlineEditDocId && (
        <DocumentModal
          doc={selectedDoc}
          onClose={() => setSelectedId(null)}
          onToggleStatus={() => toggleStatus(selectedDoc.id)}
          onEditDeadline={() => openDeadlineEdit(selectedDoc.id)}
          onDelete={() => deleteDoc(selectedDoc.id)}
        />
      )}

      {deadlineEditDocId && (() => {
        const d = docs.find((x) => x.id === deadlineEditDocId);
        if (!d) return null;
        return (
          <DeadlineEditModal
            doc={d}
            onCancel={() => setDeadlineEditDocId(null)}
            onSave={saveDeadlineEdit}
          />
        );
      })()}

      {selectedReminderId && !reminderFormOpen && (() => {
        const r = reminders.find((x) => x.id === selectedReminderId);
        if (!r) return null;
        const linkedDoc = r.docId ? docs.find((x) => x.id === r.docId) : null;
        return (
          <ReminderDetailModal
            reminder={r}
            doc={linkedDoc}
            onClose={() => setSelectedReminderId(null)}
            onEdit={openEditReminder}
            onDelete={deleteReminder}
            onToggleDone={toggleSelectedReminderDone}
            onOpenDoc={(id) => {
              setSelectedReminderId(null);
              setSelectedId(id);
            }}
          />
        );
      })()}

      {reminderFormOpen && (
        <ReminderFormModal
          initial={
            reminderFormMode === "edit"
              ? reminders.find((r) => r.id === selectedReminderId)
              : reminderFormPrefill
          }
          docs={docs}
          onCancel={closeReminderForm}
          onSave={saveReminder}
        />
      )}

      {appealDocId && (() => {
        const d = docs.find((x) => x.id === appealDocId);
        if (!d) return null;
        return (
          <AppealModal
            doc={d}
            apiBase={API_BASE}
            onClose={() => setAppealDocId(null)}
            onScheduleReminder={handleAppealScheduleReminder}
            onShowReplyDraft={handleAppealShowReplyDraft}
          />
        );
      })()}

      {selectedContactId && !contactFormOpen && (() => {
        const c = contacts.find((x) => x.id === selectedContactId);
        if (!c) return null;
        return (
          <ContactDetailModal
            contact={c}
            docs={docs}
            onClose={() => setSelectedContactId(null)}
            onEdit={() => {
              setContactFormMode("edit");
              setContactFormOpen(true);
            }}
            onDelete={deleteContact}
          />
        );
      })()}

      {contactFormOpen && (
        <ContactFormModal
          initial={
            contactFormMode === "edit"
              ? contacts.find((c) => c.id === selectedContactId)
              : contactFormPrefill
          }
          onCancel={closeContactForm}
          onSave={saveContact}
        />
      )}

      {pendingResult && !contactFormOpen && (
        <PostScanModal
          result={pendingResult}
          onConfirm={handlePostScanConfirm}
          onSkip={handlePostScanSkip}
        />
      )}

      {disclaimerOpen && (
        <DisclaimerModal onAcknowledge={acknowledgeDisclaimer} />
      )}
    </div>
  );
}
