import { useEffect, useMemo, useRef, useState } from "react";
import API_BASE from "./config.js";
import "./App.css";

const TODAY = new Date("2026-07-02T00:00:00");
const STORAGE_KEY = "behoerdenpost_docs";
const DISCLAIMER_KEY = "disclaimer_shown";
const ONBOARDING_KEY = "onboarding_done";
const EMAIL_KEY = "user_email";

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || "");
}

function sendDeadlineReminders(docs) {
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
  { id: "archive", label: "Archiv", Icon: IconArchive },
];

const INITIAL_DOCS = [
  {
    id: "d1",
    title: "Mahnung Einkommensteuer 2024",
    sender: "Finanzamt München-Mitte",
    category: "Finanzamt",
    date: "2026-06-24",
    deadline: "2026-07-05",
    amount: "230,00 €",
    summary:
      "Letztmalige Zahlungsaufforderung über 230,00 €. Bei Nichtzahlung drohen Vollstreckungsmaßnahmen.",
    status: "Offen",
  },
  {
    id: "d2",
    title: "Beitragsanpassung 2026",
    sender: "Techniker Krankenkasse",
    category: "Krankenkasse",
    date: "2026-06-15",
    deadline: "2026-07-12",
    summary:
      "Der Beitragssatz erhöht sich zum 01.08.2026 um 0,3 Prozentpunkte. Sonderkündigungsrecht besteht.",
    status: "Pending",
  },
  {
    id: "d3",
    title: "Nebenkostenabrechnung 2025",
    sender: "Hausverwaltung Schmidt GmbH",
    category: "Vermieter",
    date: "2026-05-20",
    amount: "342,00 €",
    summary: "Nachzahlung in Höhe von 342 € am 15.06.2026 überwiesen.",
    status: "Erledigt",
  },
  {
    id: "d4",
    title: "KFZ-Versicherung Verlängerung",
    sender: "HUK-Coburg",
    category: "Versicherung",
    date: "2026-04-10",
    summary: "Vertragsverlängerung für 2026/27 bestätigt.",
    status: "Erledigt",
  },
];

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

function DocumentModal({ doc, onClose, onToggleStatus }) {
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
            <div className="detail-deadline-label">Frist</div>
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

        <div className="detail-actions">
          <button
            type="button"
            className={`btn-status ${isDone ? "btn-status-reopen" : "btn-status-done"}`}
            onClick={onToggleStatus}
          >
            {isDone ? "Als offen markieren" : "Als erledigt markieren"}
          </button>
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

function HomeView({ docs, onNav, onOpenDoc }) {
  const openDeadlines = docs
    .filter((d) => d.deadline && d.status !== "Erledigt")
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  const openCount = docs.filter((d) => d.status === "Offen").length;

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
          <div className="stat-value">{openDeadlines.length}</div>
          <div className="stat-label">Offene Fristen</div>
        </div>
        <div className="stat">
          <div className="stat-value">{docs.length}</div>
          <div className="stat-label">Briefe gesamt</div>
        </div>
      </section>

      <h2 className="section-title">Anstehende Fristen</h2>
      <div className="deadline-list">
        {openDeadlines.length === 0 && (
          <div className="empty">Keine offenen Fristen.</div>
        )}
        {openDeadlines.map((d) => {
          const days = daysUntil(d.deadline);
          const level = deadlineLevel(days);
          return (
            <button
              key={d.id}
              type="button"
              className="card deadline-card"
              onClick={() => onOpenDoc(d.id)}
            >
              <div className="deadline-head">
                <div className="deadline-info">
                  <div className="deadline-title">{d.title}</div>
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
                {d.amount && ` · ${d.amount}`}
              </div>
            </button>
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

function ScanView({ docs, onAnalyzed, onOpenDoc }) {
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
      const today = new Date().toISOString().slice(0, 10);
      onAnalyzed({
        id: "d" + Date.now(),
        title: result.documentType || file.name,
        sender: "Scan · " + file.name,
        category: result.category || "Sonstiges",
        date: today,
        deadline: result.deadline,
        summary: result.summary,
        replyDraft: result.replyDraft,
        status: "Offen",
      });
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

function ArchiveView({ docs, categoryFilter, onClearCategoryFilter, onOpenDoc }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const years = useMemo(
    () => [...new Set(docs.map((d) => d.date.slice(0, 4)))].sort().reverse(),
    [docs]
  );

  const filtered = docs.filter((d) => {
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
  });

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
              <div className="doc-title">{d.title}</div>
              <div className="doc-meta">
                {d.sender} · {formatDate(d.date)} · {d.category}
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
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
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
    if (!onboardingDone) return;
    sendDeadlineReminders(docs);
    // Only run when onboarding transitions to done (returning users on mount,
    // new users after they finish step 3). Docs snapshot at that moment is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingDone]);

  const selectedDoc = docs.find((d) => d.id === selectedId);

  function addDoc(doc) {
    setDocs((prev) => [doc, ...prev]);
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

  function navigate(nextTab) {
    if (nextTab !== "archive") setCategoryFilter(null);
    setTab(nextTab);
  }

  function openCategory(name) {
    setCategoryFilter(name);
    setTab("archive");
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
            onNav={navigate}
            onOpenDoc={setSelectedId}
          />
        )}
        {tab === "scan" && (
          <ScanView
            docs={docs}
            onAnalyzed={addDoc}
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

      {selectedDoc && (
        <DocumentModal
          doc={selectedDoc}
          onClose={() => setSelectedId(null)}
          onToggleStatus={() => toggleStatus(selectedDoc.id)}
        />
      )}

      {disclaimerOpen && (
        <DisclaimerModal onAcknowledge={acknowledgeDisclaimer} />
      )}
    </div>
  );
}
