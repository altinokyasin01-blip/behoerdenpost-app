import { useState } from "react";
import { IconSearch } from "../components/icons.jsx";
import ShowMoreButton from "../components/ShowMoreButton.jsx";

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

export default function ContactsView({ contacts, onAdd, onOpenDetail }) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

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
            {(showAll ? filtered : filtered.slice(0, 5)).map((c) => (
              <ContactCard
                key={c.id}
                contact={c}
                onClick={() => onOpenDetail(c.id)}
              />
            ))}
          </div>
          <ShowMoreButton
            total={filtered.length}
            visibleCount={5}
            expanded={showAll}
            onToggle={() => setShowAll((v) => !v)}
          />
        </>
      )}
    </div>
  );
}
