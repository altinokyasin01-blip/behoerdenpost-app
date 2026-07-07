import { useEffect, useState } from "react";
import Modal from "../components/Modal.jsx";
import { daysUntil, formatDate } from "../utils/format.js";
import { authFetch } from "../utils/apiFetch.js";

export default function AppealModal({
  doc,
  apiBase,
  accessToken,
  onClose,
  onScheduleReminder,
  onShowReplyDraft,
}) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await authFetch(
          `${apiBase}/api/appeal`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              documentType: doc.title,
              summary: doc.summary,
              deadlineType: doc.deadlineType,
            }),
          },
          accessToken
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) setAnalysis(data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const days = doc.deadline ? daysUntil(doc.deadline) : null;
  const worthwhile = analysis ? analysis.worthwhile !== false : true;

  return (
    <Modal onClose={onClose}>
      <div className="detail">
        <div className="detail-head">
          <div className="detail-title">Möchtest du Widerspruch einlegen?</div>
          {doc.deadline && (
            <div className="detail-sender">
              Frist {formatDate(doc.deadline)}
              {days != null && (
                <>
                  {" · "}
                  {days > 0
                    ? `noch ${days} Tag${days === 1 ? "" : "e"}`
                    : days === 0
                    ? "heute fällig"
                    : "überfällig"}
                </>
              )}
            </div>
          )}
        </div>

        {loading && (
          <div className="appeal-loading">
            <div className="loading-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div>Claude prüft die Erfolgsaussicht…</div>
          </div>
        )}

        {error && (
          <div className="alert">
            Einschätzung konnte nicht geladen werden ({error}).
          </div>
        )}

        {analysis && (
          <section className="detail-section appeal-analysis">
            <p className="detail-text">{analysis.reasoning}</p>
            <div className="appeal-chance-row">
              <span className="appeal-chance-label">Erfolgsaussicht</span>
              <span className={`appeal-badge appeal-badge-${analysis.successChance}`}>
                {analysis.successChance}
              </span>
            </div>
            {analysis.tip && (
              <div className="appeal-tip">{analysis.tip}</div>
            )}
          </section>
        )}

        <div className="appeal-actions">
          {!loading && !error && !worthwhile && (
            <div className="appeal-warning">Trotzdem widersprechen?</div>
          )}
          <button
            type="button"
            className={`btn-secondary ${!loading && !worthwhile ? "btn-dimmed" : ""}`}
            onClick={onScheduleReminder}
            disabled={loading}
          >
            Ja, erinnere mich früher
          </button>
          <button
            type="button"
            className={`btn-secondary ${!loading && !worthwhile ? "btn-dimmed" : ""}`}
            onClick={onShowReplyDraft}
            disabled={loading || !doc.replyDraft}
          >
            Antwortentwurf anzeigen
          </button>
        </div>

        <div className="appeal-decision">Die Entscheidung liegt bei dir.</div>
        <div className="appeal-disclaimer">
          Einschätzung basiert auf KI, kein Rechtsrat.
        </div>
      </div>
    </Modal>
  );
}
