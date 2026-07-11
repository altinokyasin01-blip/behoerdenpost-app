import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../components/Modal.jsx";
import TabTip from "../components/TabTip.jsx";
import ShowMoreButton from "../components/ShowMoreButton.jsx";
import { IconSearch } from "../components/icons.jsx";
import { formatAmount, formatDate } from "../utils/format.js";

const SEARCH_TIP =
  "Suche nach Absendern oder Stichworten aus dem Brief — auch im Volltext gescannter Dokumente.";

function normalizeCompact(s) {
  return String(s || "").replace(/[\s\-./]/g, "").toLowerCase();
}

function parseAmountQuery(s) {
  const t = String(s).replace(/[€\s]/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseDateQuery(s) {
  const t = String(s).trim();
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return null;
}

function makeTextSnippet(text, query, before = 30, after = 60) {
  if (!text) return "";
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text.slice(0, before + after);
  const start = Math.max(0, idx - before);
  const end = Math.min(text.length, idx + query.length + after);
  return (start > 0 ? "…" : "") + text.slice(start, end).replace(/\s+/g, " ") + (end < text.length ? "…" : "");
}

function searchAll(query, { docs, contacts, reminders, events, fileIndex }) {
  const qRaw = query.trim();
  if (!qRaw) return null;
  const q = qRaw.toLowerCase();
  const qCompact = normalizeCompact(qRaw);
  const qAmount = parseAmountQuery(qRaw);
  const qDate = parseDateQuery(qRaw);

  function textField(field, value) {
    if (!value) return null;
    const s = String(value);
    if (s.toLowerCase().includes(q)) return { field, snippet: s };
    if (qCompact && normalizeCompact(s).includes(qCompact)) {
      return { field, snippet: s };
    }
    return null;
  }
  function amountField(field, value) {
    if (qAmount == null || value == null) return null;
    if (Math.abs(Number(value) - qAmount) < 0.005) {
      return { field, snippet: formatAmount(value) };
    }
    return null;
  }
  function dateField(field, value) {
    if (!qDate || !value) return null;
    if (value === qDate) return { field, snippet: formatDate(value) };
    return null;
  }
  function fullTextField(field, value) {
    if (!value) return null;
    const s = String(value);
    const lower = s.toLowerCase();
    if (lower.includes(q)) {
      return { field, snippet: makeTextSnippet(s, qRaw) };
    }
    if (qCompact && normalizeCompact(s).includes(qCompact)) {
      return { field, snippet: makeTextSnippet(s, qRaw) };
    }
    return null;
  }

  const docHits = [];
  for (const d of docs) {
    const match =
      textField("Titel", d.title) ||
      textField("Absender", d.sender) ||
      textField("Kategorie", d.category) ||
      textField("Zusammenfassung", d.summary) ||
      textField("Notiz", d.notes) ||
      textField("Antwortentwurf", d.replyDraft) ||
      fullTextField("Volltext", d.fullText) ||
      amountField("Betrag", d.amount) ||
      dateField("Frist", d.deadline) ||
      dateField("Datum", d.date);
    if (match) docHits.push({ item: d, ...match });
  }
  const contactHits = [];
  for (const c of contacts) {
    const match =
      textField("Name", c.name) ||
      textField("IBAN", c.iban) ||
      textField("BIC", c.bic) ||
      textField("E-Mail", c.email) ||
      textField("Telefon", c.phone) ||
      textField(
        "Adresse",
        [c.street, c.zip, c.city].filter(Boolean).join(" ")
      ) ||
      textField("Notizen", c.notes);
    if (match) contactHits.push({ item: c, ...match });
  }
  const reminderHits = [];
  for (const r of reminders) {
    const match =
      textField("Titel", r.title) ||
      textField("Notiz", r.notes) ||
      dateField("Datum", r.date);
    if (match) reminderHits.push({ item: r, ...match });
  }
  const eventHits = [];
  for (const e of events) {
    const match =
      textField("Titel", e.title) ||
      textField("Notizen", e.notes) ||
      textField("Uhrzeit", e.time) ||
      dateField("Datum", e.date);
    if (match) eventHits.push({ item: e, ...match });
  }
  const localFileHits = [];
  if (fileIndex && Array.isArray(fileIndex.folders)) {
    for (const folder of fileIndex.folders) {
      for (const f of folder.files) {
        const nameMatch =
          f.name.toLowerCase().includes(q) ||
          (qCompact && normalizeCompact(f.name).includes(qCompact));
        if (nameMatch) {
          localFileHits.push({
            item: { ...f, folderId: folder.id, folderName: folder.name },
            field: "Dateiname",
            snippet: f.path,
          });
          continue;
        }
        if (f.text && f.text.toLowerCase().includes(q)) {
          localFileHits.push({
            item: { ...f, folderId: folder.id, folderName: folder.name },
            field: "Inhalt",
            snippet: makeTextSnippet(f.text, qRaw),
          });
        }
      }
    }
  }

  const total =
    docHits.length +
    contactHits.length +
    reminderHits.length +
    eventHits.length +
    localFileHits.length;
  return {
    docs: docHits,
    contacts: contactHits,
    reminders: reminderHits,
    events: eventHits,
    localFiles: localFileHits,
    total,
  };
}

function SearchHit({ icon, title, field, snippet, onClick }) {
  return (
    <button type="button" className="search-hit" onClick={onClick}>
      <div className="search-hit-icon">{icon}</div>
      <div className="search-hit-body">
        <div className="search-hit-title">{title}</div>
        <div className="search-hit-meta">
          <span className="search-hit-field">{field}</span>
          <span className="search-hit-snippet">{snippet}</span>
        </div>
      </div>
    </button>
  );
}

export default function SearchModal({
  docs,
  contacts,
  reminders,
  events,
  fileIndex,
  showTip,
  onDismissTip,
  onOpenDoc,
  onOpenContact,
  onOpenReminder,
  onOpenEvent,
  onOpenLocalFile,
  onClose,
}) {
  const [query, setQuery] = useState("");
  const [showAllDocs, setShowAllDocs] = useState(false);
  const [showAllContacts, setShowAllContacts] = useState(false);
  const [showAllReminders, setShowAllReminders] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [showAllLocalFiles, setShowAllLocalFiles] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(
    () => searchAll(query, { docs, contacts, reminders, events, fileIndex }),
    [query, docs, contacts, reminders, events, fileIndex]
  );

  function pick(handler) {
    return (id) => {
      onClose();
      handler(id);
    };
  }
  const openDoc = pick(onOpenDoc);
  const openContact = pick(onOpenContact);
  const openReminder = pick(onOpenReminder);
  const openEvent = pick(onOpenEvent);
  function openLocalFile(item) {
    onClose();
    onOpenLocalFile(item);
  }

  return (
    <Modal onClose={onClose}>
      <div className="search-modal">
        <div className="search-input-wrap">
          <IconSearch size={20} />
          <input
            ref={inputRef}
            type="text"
            className="search-input-large"
            placeholder="Nach allem suchen — Finanzamt, Mahnung, Kündigung…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {showTip && (
          <TabTip text={SEARCH_TIP} onDismiss={onDismissTip} />
        )}

        {!results && (
          <div className="search-empty-state">
            <h3 className="search-empty-title">Was suchst du?</h3>
            <ul className="search-hints">
              <li>
                <strong>Finanzamt</strong> — Absender oder Kontaktname, auch als Bruchstück
              </li>
              <li>
                <strong>Mahnung</strong> — ein Stichwort aus dem Brief, auch im Volltext gefunden
              </li>
            </ul>
            <div className="search-shortcut-hint">
              Tipp: <kbd>⌘</kbd>+<kbd>K</kbd> (oder <kbd>Strg</kbd>+<kbd>K</kbd>) öffnet die Suche überall
            </div>
          </div>
        )}

        {results && results.total === 0 && (
          <div className="empty">Keine Treffer für „{query}".</div>
        )}

        {results && results.total > 0 && (
          <div className="search-results">
            {results.docs.length > 0 && (
              <section className="search-group">
                <h4 className="search-group-title">
                  Dokumente <span className="search-group-count">{results.docs.length}</span>
                </h4>
                {(showAllDocs ? results.docs : results.docs.slice(0, 3)).map((h) => (
                  <SearchHit
                    key={h.item.id}
                    icon="§"
                    title={h.item.title}
                    field={h.field}
                    snippet={h.snippet}
                    onClick={() => openDoc(h.item.id)}
                  />
                ))}
                <ShowMoreButton
                  total={results.docs.length}
                  visibleCount={3}
                  expanded={showAllDocs}
                  onToggle={() => setShowAllDocs((v) => !v)}
                />
              </section>
            )}
            {results.contacts.length > 0 && (
              <section className="search-group">
                <h4 className="search-group-title">
                  Kontakte <span className="search-group-count">{results.contacts.length}</span>
                </h4>
                {(showAllContacts ? results.contacts : results.contacts.slice(0, 3)).map((h) => (
                  <SearchHit
                    key={h.item.id}
                    icon="◉"
                    title={h.item.name}
                    field={h.field}
                    snippet={h.snippet}
                    onClick={() => openContact(h.item.id)}
                  />
                ))}
                <ShowMoreButton
                  total={results.contacts.length}
                  visibleCount={3}
                  expanded={showAllContacts}
                  onToggle={() => setShowAllContacts((v) => !v)}
                />
              </section>
            )}
            {results.reminders.length > 0 && (
              <section className="search-group">
                <h4 className="search-group-title">
                  Erinnerungen <span className="search-group-count">{results.reminders.length}</span>
                </h4>
                {(showAllReminders ? results.reminders : results.reminders.slice(0, 3)).map((h) => (
                  <SearchHit
                    key={h.item.id}
                    icon="◐"
                    title={h.item.title}
                    field={h.field}
                    snippet={h.snippet}
                    onClick={() => openReminder(h.item.id)}
                  />
                ))}
                <ShowMoreButton
                  total={results.reminders.length}
                  visibleCount={3}
                  expanded={showAllReminders}
                  onToggle={() => setShowAllReminders((v) => !v)}
                />
              </section>
            )}
            {results.events.length > 0 && (
              <section className="search-group">
                <h4 className="search-group-title">
                  Termine <span className="search-group-count">{results.events.length}</span>
                </h4>
                {(showAllEvents ? results.events : results.events.slice(0, 3)).map((h) => (
                  <SearchHit
                    key={h.item.id}
                    icon="◆"
                    title={h.item.title}
                    field={h.field}
                    snippet={h.snippet}
                    onClick={() => openEvent(h.item.id)}
                  />
                ))}
                <ShowMoreButton
                  total={results.events.length}
                  visibleCount={3}
                  expanded={showAllEvents}
                  onToggle={() => setShowAllEvents((v) => !v)}
                />
              </section>
            )}
            {results.localFiles && results.localFiles.length > 0 && (
              <section className="search-group">
                <h4 className="search-group-title">
                  Lokale Dateien <span className="search-group-count">{results.localFiles.length}</span>
                </h4>
                {(showAllLocalFiles ? results.localFiles : results.localFiles.slice(0, 3)).map((h, i) => (
                  <SearchHit
                    key={`${h.item.folderId}-${h.item.path}-${i}`}
                    icon="≡"
                    title={h.item.name}
                    field={h.field}
                    snippet={`${h.item.folderName}/${h.item.path} — ${h.snippet}`}
                    onClick={() => openLocalFile(h.item)}
                  />
                ))}
                <ShowMoreButton
                  total={results.localFiles.length}
                  visibleCount={3}
                  expanded={showAllLocalFiles}
                  onToggle={() => setShowAllLocalFiles((v) => !v)}
                />
              </section>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
