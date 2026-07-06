import { useMemo, useState } from "react";
import { IconSearch } from "../components/icons.jsx";
import { CategoryEditor } from "../components/CategoryChip.jsx";
import DeadlineTypeBadge from "../components/DeadlineTypeBadge.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import CardMenu from "../components/CardMenu.jsx";
import { formatDate } from "../utils/format.js";

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

export default function ArchiveView({
  docs,
  categoryFilter,
  onClearCategoryFilter,
  onOpenDoc,
  existingCategories,
  onUpdateCategory,
}) {
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("date_desc");
  const [search, setSearch] = useState("");
  const [editingCategoryDocId, setEditingCategoryDocId] = useState(null);

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
        {filtered.map((d) => {
          if (editingCategoryDocId === d.id) {
            return (
              <div key={d.id} className="card doc-card doc-card-editing">
                <div className="doc-body">
                  <div className="doc-title">{d.title}</div>
                  <div className="doc-meta">Kategorie ändern:</div>
                  <CategoryEditor
                    value={d.category}
                    existingCategories={existingCategories}
                    onChange={(cat) => {
                      onUpdateCategory(d.id, cat);
                      setEditingCategoryDocId(null);
                    }}
                    onCancel={() => setEditingCategoryDocId(null)}
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
              <CardMenu
                items={[
                  {
                    label: "Kategorie ändern",
                    onClick: () => setEditingCategoryDocId(d.id),
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
