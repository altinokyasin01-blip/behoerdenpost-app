import { useState } from "react";
import Modal from "../components/Modal.jsx";
import CategoryChip from "../components/CategoryChip.jsx";
import { IconCalendar } from "../components/icons.jsx";
import { formatAmount, formatDate } from "../utils/format.js";

const ACTION_TYPE_LABEL = {
  contact: "Kontakt",
  reminder: "Erinnerung",
  amount: "Betrag",
  deadline: "Frist",
  note: "Notiz",
  event: "Termin",
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
  if (action.type === "event") {
    const v = action.value || {};
    const parts = [];
    if (v.date) parts.push(formatDate(v.date));
    if (v.time) parts.push(v.time);
    if (v.notes) parts.push(v.notes);
    return parts.join(" · ");
  }
  if (action.type === "contact") {
    // value can be either a plain string (legacy) or a rich object
    if (typeof action.value === "string") return action.value;
    const v = action.value || {};
    const parts = [v.name];
    if (v.type) parts.push(v.type);
    const loc = [v.zip, v.city].filter(Boolean).join(" ");
    if (loc) parts.push(loc);
    if (v.email) parts.push(v.email);
    return parts.filter(Boolean).join(" · ");
  }
  return String(action.value);
}

export default function PostScanModal({
  result,
  isFirstScan,
  existingCategories,
  categoryPrefill,
  onConfirm,
  onSkip,
}) {
  const actions = Array.isArray(result.actions) ? result.actions : [];

  const [enabled, setEnabled] = useState(() => {
    const map = {};
    actions.forEach((a, i) => {
      map[i] = a.priority !== "low";
    });
    return map;
  });
  const [categoryDraft, setCategoryDraft] = useState(
    // Explicit user context (scanned from a category page) outranks Claude's guess.
    categoryPrefill || result.category || "Sonstiges"
  );
  const [recurringDraft, setRecurringDraft] = useState(!!result.recurring);

  function toggle(i) {
    setEnabled((prev) => ({ ...prev, [i]: !prev[i] }));
  }

  function handleConfirm() {
    onConfirm(
      actions.filter((_, i) => enabled[i]),
      { category: categoryDraft, recurring: recurringDraft }
    );
  }

  return (
    <Modal onClose={onSkip}>
      <div className="detail">
        <div className="detail-head">
          <div className="detail-title">
            Erkannt: {result.documentType || "Dokument"}
          </div>
          <div className="detail-badges">
            <CategoryChip
              value={categoryDraft}
              existingCategories={existingCategories}
              onChange={setCategoryDraft}
            />
            {result.sender && (
              <span className="detail-sender">{result.sender}</span>
            )}
          </div>
          {result.summary && (
            <div className="postscan-summary">{result.summary}</div>
          )}
        </div>

        {isFirstScan && (
          <div className="tutorial-inline">
            <strong>Fast fertig!</strong> Claude hat dein Dokument gelesen und
            schlägt konkrete Actions vor. Wähle unten aus, was für dich Sinn
            ergibt — der Rest wird ignoriert.
          </div>
        )}

        <label className="google-sync-toggle">
          <input
            type="checkbox"
            checked={recurringDraft}
            onChange={(e) => setRecurringDraft(e.target.checked)}
          />
          <div className="google-sync-body">
            <div className="google-sync-title">Wiederkehrende Zahlung</div>
            <div className="google-sync-sub">
              Abo, Dauerauftrag oder Lastschrift, die sich regelmäßig wiederholt
            </div>
          </div>
        </label>

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
                    {a.type === "event" && (
                      <span className="action-icon-lead">
                        <IconCalendar size={14} />
                      </span>
                    )}
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
