import { useMemo, useState } from "react";
import { IconCamera } from "../components/icons.jsx";
import { CategoryEditor } from "../components/CategoryChip.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import CardMenu from "../components/CardMenu.jsx";
import CategoryRenameModal from "../modals/CategoryRenameModal.jsx";
import { categorySymbol } from "../utils/domainConstants.js";
import { formatDate } from "../utils/format.js";

export default function CategoriesView({
  docs,
  existingCategories,
  onNav,
  onOpenDoc,
  onUpdateDocCategory,
  onRenameCategory,
  onRemoveCategory,
}) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [renamingCategory, setRenamingCategory] = useState(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDocId, setEditingDocId] = useState(null);

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
      .sort(
        (a, b) =>
          b.open - a.open ||
          b.total - a.total ||
          a.name.localeCompare(b.name)
      );
  }, [docs]);

  // ---- Detail view ----
  if (selectedCategory) {
    const catDocs = docs.filter(
      (d) => (d.category || "Sonstiges") === selectedCategory
    );
    return (
      <div className="view">
        <button
          type="button"
          className="btn-back"
          onClick={() => {
            setSelectedCategory(null);
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
                setSelectedCategory(newName);
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

        <div className="doc-list">
          {catDocs.length === 0 && (
            <div className="empty">Keine Dokumente in dieser Kategorie.</div>
          )}
          {catDocs.map((d) => {
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
                onClick={() => setSelectedCategory(g.name)}
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
