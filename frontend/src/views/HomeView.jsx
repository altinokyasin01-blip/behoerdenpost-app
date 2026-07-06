import { useState } from "react";
import { IconCamera, IconChevron } from "../components/icons.jsx";
import CardMenu from "../components/CardMenu.jsx";
import DeadlineTypeBadge from "../components/DeadlineTypeBadge.jsx";
import ShowMoreButton from "../components/ShowMoreButton.jsx";
import { DEADLINE_TYPES, DEADLINE_TYPE_LABEL, categorySymbol } from "../utils/domainConstants.js";
import {
  daysUntil,
  deadlineLevel,
  progressPct,
  formatDate,
  formatAmount,
} from "../utils/format.js";
import {
  getOpenDeadlines,
  getOpenAmounts,
  getRecurringPaymentDocIds,
  getRecentDocs,
  getCategoryGroups,
  getDocsForContact,
} from "../utils/insights.js";

// One-sentence, client-computed status line — no API call. Mirrors the
// "3 offene Fristen, davon 1 in den nächsten 3 Tagen" example exactly when
// there's an urgent one, and degrades gracefully otherwise.
function buildStatusSummary(openDeadlines, pendingPayments) {
  const total = openDeadlines.length;
  if (total === 0) {
    if (pendingPayments.length > 0) {
      return `Keine offenen Fristen, aber ${pendingPayments.length} offene Ausgabe${
        pendingPayments.length === 1 ? "" : "n"
      }.`;
    }
    return "Keine offenen Fristen — alles im grünen Bereich.";
  }
  const urgent = openDeadlines.filter((d) => daysUntil(d.deadline) <= 3).length;
  const base = `${total} offene Frist${total === 1 ? "" : "en"}`;
  if (urgent === 0) {
    return `${base}, keine davon in den nächsten 3 Tagen fällig.`;
  }
  return `${base}, davon ${urgent} in den nächsten 3 Tagen.`;
}

export default function HomeView({
  docs,
  contacts,
  reminders,
  onNav,
  onOpenDoc,
  onOpenContact,
  onOpenReminder,
  onAddReminder,
  onAddDeadline,
  onToggleReminder,
  onToggleDocStatus,
  onEditDeadline,
  onOpenAppeal,
}) {
  const [deadlineFilter, setDeadlineFilter] = useState("all");
  const [showAllDeadlines, setShowAllDeadlines] = useState(false);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [showAllReminders, setShowAllReminders] = useState(false);

  const allOpenDeadlines = getOpenDeadlines(docs);

  const openDeadlines = allOpenDeadlines.filter(
    (d) => deadlineFilter === "all" || (d.deadlineType || "sonstiges") === deadlineFilter
  );

  const pendingPayments = getOpenAmounts(docs);
  const paymentsTotal = pendingPayments.reduce(
    (sum, d) => sum + (typeof d.amount === "number" ? d.amount : 0),
    0
  );
  const recurringDocIds = getRecurringPaymentDocIds(docs);

  const statusSummary = buildStatusSummary(allOpenDeadlines, pendingPayments);
  const recentDocs = getRecentDocs(docs, 5);
  const topCategories = getCategoryGroups(docs).slice(0, 3);
  const topContacts = contacts
    .map((c) => ({ contact: c, count: getDocsForContact(docs, c).length }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((x) => x.contact);

  const openReminders = (reminders || [])
    .filter((r) => !r.done)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

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
        <p className="lead">{statusSummary}</p>
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

      <div className="section-title-row">
        <h2 className="section-title section-title-inline">Anstehende Fristen</h2>
        <button
          type="button"
          className="btn-primary btn-primary-sm"
          onClick={onAddDeadline}
        >
          + Frist
        </button>
      </div>
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
        {(showAllDeadlines ? openDeadlines : openDeadlines.slice(0, 3)).map((d) => {
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
      <ShowMoreButton
        total={openDeadlines.length}
        visibleCount={3}
        expanded={showAllDeadlines}
        onToggle={() => setShowAllDeadlines((v) => !v)}
      />

      {pendingPayments.length > 0 && (
        <>
          <div className="section-title-row">
            <h2 className="section-title section-title-inline">Anstehende Ausgaben</h2>
            <span className="detail-muted">{formatAmount(paymentsTotal)} offen</span>
          </div>
          <div className="linked-list">
            {(showAllPayments ? pendingPayments : pendingPayments.slice(0, 3)).map((d) => {
              const days = d.deadline ? daysUntil(d.deadline) : null;
              const level = days != null ? deadlineLevel(days) : "gray";
              const recurring = recurringDocIds.has(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  className="linked-item linked-clickable"
                  onClick={() => onOpenDoc(d.id)}
                >
                  <div className="linked-title">
                    {d.title}
                    {recurring && (
                      <span className="badge badge-neutral" style={{ marginLeft: 6 }}>
                        Wiederkehrend
                      </span>
                    )}
                  </div>
                  <div className={`linked-meta days-${level}`}>
                    {d.deadline ? `Fällig ${formatDate(d.deadline)}` : "Ohne Frist"}
                    {d.sender && ` · ${d.sender}`}
                    {" · "}
                    {formatAmount(d.amount)}
                  </div>
                </button>
              );
            })}
          </div>
          <ShowMoreButton
            total={pendingPayments.length}
            visibleCount={3}
            expanded={showAllPayments}
            onToggle={() => setShowAllPayments((v) => !v)}
          />
        </>
      )}

      <h2 className="section-title">Letzte Aktivität</h2>
      {recentDocs.length === 0 ? (
        <div className="empty">Noch keine Dokumente gescannt.</div>
      ) : (
        <div className="linked-list">
          {recentDocs.map((d) => (
            <button
              key={d.id}
              type="button"
              className="linked-item linked-clickable"
              onClick={() => onOpenDoc(d.id)}
            >
              <div className="linked-title">{d.title}</div>
              <div className="linked-meta">
                {formatDate(d.date)}
                {d.sender && ` · ${d.sender}`}
              </div>
            </button>
          ))}
        </div>
      )}

      {(topCategories.length > 0 || topContacts.length > 0) && (
        <>
          <h2 className="section-title">Schnellzugriff</h2>
          {topCategories.length > 0 && (
            <div className="filter-pills">
              {topCategories.map((g) => (
                <button
                  key={g.name}
                  type="button"
                  className="pill"
                  onClick={() => onNav("categories")}
                >
                  {categorySymbol(g.name)} {g.name}
                </button>
              ))}
            </div>
          )}
          {topContacts.length > 0 && (
            <div className="filter-pills">
              {topContacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="pill"
                  onClick={() => onOpenContact(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}

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
        {openReminders.length === 0 && (
          <div className="empty">Keine offenen Erinnerungen.</div>
        )}
        {(showAllReminders ? openReminders : openReminders.slice(0, 3)).map((r) => {
          const days = daysUntil(r.date);
          const level = deadlineLevel(days);
          return (
            <div key={r.id} className="card reminder-card">
              <button
                type="button"
                className="reminder-check"
                onClick={() => onToggleReminder(r.id)}
                aria-label="Als erledigt markieren"
              />
              <button
                type="button"
                className="reminder-body"
                onClick={() => onOpenReminder(r.id)}
              >
                <div className="reminder-title">{r.title}</div>
                <div className={`reminder-meta days-${level}`}>
                  {formatDate(r.date)}
                  {" · "}
                  {days > 0
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
      <ShowMoreButton
        total={openReminders.length}
        visibleCount={3}
        expanded={showAllReminders}
        onToggle={() => setShowAllReminders((v) => !v)}
      />

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
