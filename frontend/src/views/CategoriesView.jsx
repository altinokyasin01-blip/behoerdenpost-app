import { useMemo, useState } from "react";
import { IconCamera, IconChevron } from "../components/icons.jsx";
import { CategoryEditor } from "../components/CategoryChip.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import CardMenu from "../components/CardMenu.jsx";
import ShowMoreButton from "../components/ShowMoreButton.jsx";
import CategoryRenameModal from "../modals/CategoryRenameModal.jsx";
import { categorySymbol } from "../utils/domainConstants.js";
import { daysUntil, deadlineLevel, formatDate, formatAmount } from "../utils/format.js";
import {
  getCategoryGroups,
  getOpenDeadlines,
  getOpenAmounts,
  getRecurringPaymentDocIds,
  findContactsForSender,
} from "../utils/insights.js";

export default function CategoriesView({
  docs,
  contacts,
  existingCategories,
  selectedCategory,
  onSelectCategory,
  onNav,
  onOpenDoc,
  onOpenContact,
  onUpdateDocCategory,
  onRenameCategory,
  onRemoveCategory,
  onScanWithCategory,
}) {
  const [renamingCategory, setRenamingCategory] = useState(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDocId, setEditingDocId] = useState(null);
  const [showAllCatDeadlines, setShowAllCatDeadlines] = useState(false);
  const [showAllCatAmounts, setShowAllCatAmounts] = useState(false);
  const [showAllCatContacts, setShowAllCatContacts] = useState(false);
  const [showAllCatDocs, setShowAllCatDocs] = useState(false);
  const [catPaymentsFilter, setCatPaymentsFilter] = useState("all");

  const groups = useMemo(() => getCategoryGroups(docs), [docs]);

  // ---- Detail view ----
  if (selectedCategory) {
    const catDocs = docs.filter(
      (d) => (d.category || "Sonstiges") === selectedCategory
    );
    const catOpenDeadlines = getOpenDeadlines(catDocs);
    const catOpenAmounts = getOpenAmounts(catDocs);
    const catRecurringDocIds = getRecurringPaymentDocIds(catDocs);
    const filteredCatAmounts = catOpenAmounts.filter((d) => {
      if (catPaymentsFilter === "all") return true;
      const isRecurring = catRecurringDocIds.has(d.id);
      return catPaymentsFilter === "recurring" ? isRecurring : !isRecurring;
    });
    const catOpenAmountsTotal = filteredCatAmounts.reduce(
      (sum, d) => sum + (typeof d.amount === "number" ? d.amount : 0),
      0
    );
    const catContacts = [];
    const seenContactIds = new Set();
    for (const d of catDocs) {
      if (!d.sender) continue;
      for (const c of findContactsForSender(contacts, d.sender)) {
        if (!seenContactIds.has(c.id)) {
          seenContactIds.add(c.id);
          catContacts.push(c);
        }
      }
    }
    const lastDoc = catDocs[0] || null;

    return (
      <div className="view">
        <button
          type="button"
          className="btn-back"
          onClick={() => {
            onSelectCategory(null);
            setEditingTitle(false);
            setEditingDocId(null);
          }}
        >
          ← Kategorien
        </button>

        <header className="view-header">
          {editingTitle ? (
            <CategoryEditor
              value={selectedCategory}
              existingCategories={existingCategories.filter(
                (c) => c !== selectedCategory
              )}
              onChange={(newName) => {
                onRenameCategory(selectedCategory, newName);
                onSelectCategory(newName);
                setEditingTitle(false);
              }}
              onCancel={() => setEditingTitle(false)}
            />
          ) : (
            <button
              type="button"
              className="cat-detail-title"
              onClick={() => setEditingTitle(true)}
              title="Kategorie umbenennen"
            >
              <span>{selectedCategory}</span>
              <span className="cat-detail-title-hint" aria-hidden="true">
                ✎
              </span>
            </button>
          )}
          <p className="lead">
            {catDocs.length} Dokument{catDocs.length === 1 ? "" : "e"}
          </p>
        </header>

        <button
          type="button"
          className="card action-card"
          onClick={() => onScanWithCategory(selectedCategory)}
        >
          <div className="action-icon">
            <IconCamera size={22} />
          </div>
          <div className="action-text">
            <div className="action-title">Brief scannen</div>
            <div className="action-sub">
              Kategorie „{selectedCategory}" wird vorbelegt
            </div>
          </div>
          <IconChevron />
        </button>

        <h2 className="section-title">Letzter Schriftverkehr</h2>
        {lastDoc ? (
          <button
            type="button"
            className="linked-item linked-clickable"
            onClick={() => onOpenDoc(lastDoc.id)}
          >
            <div className="linked-title">{lastDoc.title}</div>
            <div className="linked-meta">
              {formatDate(lastDoc.date)}
              {lastDoc.sender && ` · ${lastDoc.sender}`}
            </div>
          </button>
        ) : (
          <div className="empty">Noch keine Dokumente.</div>
        )}

        <h2 className="section-title">Unerledigte Fristen</h2>
        {catOpenDeadlines.length === 0 ? (
          <div className="empty">Keine offenen Fristen.</div>
        ) : (
          <div className="linked-list">
            {(showAllCatDeadlines ? catOpenDeadlines : catOpenDeadlines.slice(0, 3)).map((d) => {
              const days = daysUntil(d.deadline);
              const level = deadlineLevel(days);
              return (
                <button
                  key={d.id}
                  type="button"
                  className="linked-item linked-clickable"
                  onClick={() => onOpenDoc(d.id)}
                >
                  <div className="linked-title">{d.title}</div>
                  <div className={`linked-meta days-${level}`}>
                    Fällig {formatDate(d.deadline)}
                    {d.sender && ` · ${d.sender}`}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <ShowMoreButton
          total={catOpenDeadlines.length}
          visibleCount={3}
          expanded={showAllCatDeadlines}
          onToggle={() => setShowAllCatDeadlines((v) => !v)}
        />

        <h2 className="section-title">Unerledigte Beträge</h2>
        {catOpenAmounts.length > 0 && (
          <div className="filter-pills">
            {[
              { id: "all", label: "Alle" },
              { id: "recurring", label: "Wiederkehrend" },
              { id: "once", label: "Einmalig" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={`pill ${catPaymentsFilter === f.id ? "active" : ""}`}
                onClick={() => setCatPaymentsFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
        {filteredCatAmounts.length === 0 ? (
          <div className="empty">
            {catOpenAmounts.length === 0
              ? "Keine offenen Beträge."
              : "Keine Einträge für diesen Filter."}
          </div>
        ) : (
          <div className="card payments-card">
            <div className="payments-total">
              <div className="payments-total-label">Summe offen</div>
              <div className="payments-total-value">
                {formatAmount(catOpenAmountsTotal)}
              </div>
              <div className="payments-total-sub">
                {filteredCatAmounts.length} Posten
              </div>
            </div>
            <div className="payments-list">
              {(showAllCatAmounts ? filteredCatAmounts : filteredCatAmounts.slice(0, 3)).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="payment-item"
                  onClick={() => onOpenDoc(d.id)}
                >
                  <div className="payment-body">
                    <div className="payment-title">{d.title}</div>
                    <div className="payment-meta">
                      {d.deadline ? `Fällig ${formatDate(d.deadline)}` : "Ohne Frist"}
                      {d.sender && ` · ${d.sender}`}
                    </div>
                  </div>
                  <div className="payment-amount">{formatAmount(d.amount)}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        <ShowMoreButton
          total={filteredCatAmounts.length}
          visibleCount={3}
          expanded={showAllCatAmounts}
          onToggle={() => setShowAllCatAmounts((v) => !v)}
        />

        <h2 className="section-title">Verknüpfte Kontakte</h2>
        {catContacts.length === 0 ? (
          <div className="empty">Keine verknüpften Kontakte.</div>
        ) : (
          <div className="linked-list">
            {(showAllCatContacts ? catContacts : catContacts.slice(0, 3)).map((c) => (
              <button
                key={c.id}
                type="button"
                className="linked-item linked-clickable"
                onClick={() => onOpenContact(c.id)}
              >
                <div className="linked-title">{c.name}</div>
                <div className="linked-meta">{c.type}</div>
              </button>
            ))}
          </div>
        )}
        <ShowMoreButton
          total={catContacts.length}
          visibleCount={3}
          expanded={showAllCatContacts}
          onToggle={() => setShowAllCatContacts((v) => !v)}
        />

        <h2 className="section-title">Alle Dokumente</h2>
        <div className="doc-list">
          {catDocs.length === 0 && (
            <div className="empty">Keine Dokumente in dieser Kategorie.</div>
          )}
          {(showAllCatDocs ? catDocs : catDocs.slice(0, 5)).map((d) => {
            if (editingDocId === d.id) {
              return (
                <div key={d.id} className="card doc-card doc-card-editing">
                  <div className="doc-body">
                    <div className="doc-title">{d.title}</div>
                    <div className="doc-meta">Kategorie ändern:</div>
                    <CategoryEditor
                      value={d.category}
                      existingCategories={existingCategories}
                      onChange={(cat) => {
                        onUpdateDocCategory(d.id, cat);
                        setEditingDocId(null);
                      }}
                      onCancel={() => setEditingDocId(null)}
                    />
                  </div>
                </div>
              );
            }
            return (
              <div key={d.id} className="card doc-card doc-card-wrap">
                <button
                  type="button"
                  className="doc-card-body"
                  onClick={() => onOpenDoc(d.id)}
                >
                  <div className="doc-body">
                    <div className="doc-title">{d.title}</div>
                    <div className="doc-meta">
                      {formatDate(d.date)}
                      {d.sender && ` · ${d.sender}`}
                    </div>
                  </div>
                  <StatusBadge status={d.status} />
                </button>
                <CardMenu
                  items={[
                    { label: "Öffnen", onClick: () => onOpenDoc(d.id) },
                    {
                      label: "Kategorie ändern",
                      onClick: () => setEditingDocId(d.id),
                    },
                  ]}
                />
              </div>
            );
          })}
        </div>
        <ShowMoreButton
          total={catDocs.length}
          visibleCount={5}
          expanded={showAllCatDocs}
          onToggle={() => setShowAllCatDocs((v) => !v)}
        />
      </div>
    );
  }

  // ---- Overview ----
  return (
    <div className="view">
      <header className="view-header">
        <h1>Kategorien</h1>
        <p className="lead">
          Deine Post nach Kategorien gruppiert. Klick eine Karte zum Öffnen.
        </p>
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
            <div key={g.name} className="card cat-card cat-card-wrap">
              <button
                type="button"
                className="cat-card-body"
                onClick={() => onSelectCategory(g.name)}
              >
                <div className="cat-symbol">{categorySymbol(g.name)}</div>
                <div className="cat-name">{g.name}</div>
                <div className="cat-meta">
                  {g.total} Brief{g.total === 1 ? "" : "e"}
                  {g.open > 0 && (
                    <>
                      {" · "}
                      <span className="text-red">{g.open} unerledigt</span>
                    </>
                  )}
                </div>
              </button>
              <CardMenu
                items={[
                  {
                    label: "Umbenennen",
                    onClick: () => setRenamingCategory(g.name),
                  },
                  {
                    label: "Löschen",
                    onClick: () => {
                      if (
                        confirm(
                          `Kategorie „${g.name}" löschen? Die Dokumente bleiben erhalten und wechseln zu „Sonstiges".`
                        )
                      ) {
                        onRemoveCategory(g.name);
                      }
                    },
                  },
                ]}
              />
            </div>
          ))}
        </div>
      )}

      {renamingCategory && (
        <CategoryRenameModal
          value={renamingCategory}
          existingCategories={existingCategories.filter(
            (c) => c !== renamingCategory
          )}
          onSave={(newName) => {
            onRenameCategory(renamingCategory, newName);
            setRenamingCategory(null);
          }}
          onCancel={() => setRenamingCategory(null)}
        />
      )}
    </div>
  );
}
