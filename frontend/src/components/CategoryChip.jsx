import { useEffect, useMemo, useRef, useState } from "react";

export function CategoryEditor({
  value,
  existingCategories = [],
  onChange,
  onCancel,
}) {
  const [draft, setDraft] = useState(value || "");
  const inputRef = useRef(null);
  const listId = useMemo(
    () => "catlist-" + Math.random().toString(36).slice(2, 8),
    []
  );

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function commit() {
    const v = draft.trim();
    if (v && v !== value) {
      onChange(v);
    } else {
      onCancel?.();
    }
  }

  return (
    <div className="category-editor">
      <input
        ref={inputRef}
        type="text"
        list={listId}
        className="form-input category-editor-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel?.();
          }
        }}
        placeholder="Kategorie eingeben oder wählen"
        autoComplete="off"
      />
      <datalist id={listId}>
        {existingCategories.map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>
      <button
        type="button"
        className="btn-primary btn-primary-sm"
        onClick={commit}
      >
        Übernehmen
      </button>
      <button
        type="button"
        className="btn-secondary btn-primary-sm"
        onClick={() => onCancel?.()}
      >
        Abbrechen
      </button>
    </div>
  );
}

export default function CategoryChip({ value, existingCategories, onChange }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <CategoryEditor
        value={value}
        existingCategories={existingCategories}
        onChange={(v) => {
          onChange(v);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }
  return (
    <button
      type="button"
      className="badge badge-neutral badge-editable"
      onClick={() => setEditing(true)}
      title="Kategorie bearbeiten"
    >
      {value || "Kategorie hinzufügen"}
      <span className="badge-edit-hint" aria-hidden="true">
        ✎
      </span>
    </button>
  );
}
