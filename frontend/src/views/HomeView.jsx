import { useState } from "react";
import { IconCamera, IconChevron } from "../components/icons.jsx";
import CardMenu from "../components/CardMenu.jsx";
import DeadlineTypeBadge from "../components/DeadlineTypeBadge.jsx";
import { DEADLINE_TYPES, DEADLINE_TYPE_LABEL } from "../utils/domainConstants.js";
import {
  daysUntil,
  deadlineLevel,
  progressPct,
  formatDate,
  formatAmount,
} from "../utils/format.js";

export default function HomeView({
  docs,
  reminders,
  onNav,
  onOpenDoc,
  onOpenReminder,
  onAddReminder,
  onAddDeadline,
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

  const pendingPayments = docs
    .filter((d) => d.amount != null && d.status !== "Erledigt")
    .sort((a, b) => (a.deadline || "9").localeCompare(b.deadline || "9"));
  const paymentsTotal = pendingPayments.reduce(
    (sum, d) => sum + (typeof d.amount === "number" ? d.amount : 0),
    0
  );

  const openCount = docs.filter((d) => d.status === "Offen").length;
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

      {pendingPayments.length > 0 && (
        <>
          <h2 className="section-title">Anstehende Ausgaben</h2>
          <div className="card payments-card">
            <div className="payments-total">
              <div className="payments-total-label">Summe offen</div>
              <div className="payments-total-value">
                {formatAmount(paymentsTotal)}
              </div>
              <div className="payments-total-sub">
                {pendingPayments.length} Posten
              </div>
            </div>
            <div className="payments-list">
              {pendingPayments.map((d) => {
                const days = d.deadline ? daysUntil(d.deadline) : null;
                const level = days != null ? deadlineLevel(days) : "gray";
                return (
                  <button
                    key={d.id}
                    type="button"
                    className="payment-item"
                    onClick={() => onOpenDoc(d.id)}
                  >
                    <div className="payment-body">
                      <div className="payment-title">{d.title}</div>
                      <div className={`payment-meta days-${level}`}>
                        {d.deadline
                          ? `Fällig ${formatDate(d.deadline)}`
                          : "Ohne Frist"}
                        {d.sender && ` · ${d.sender}`}
                      </div>
                    </div>
                    <div className="payment-amount">{formatAmount(d.amount)}</div>
                  </button>
                );
              })}
            </div>
          </div>
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
        {openReminders.map((r) => {
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
