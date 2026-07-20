import { useState } from "react";
import { IconChevron, IconFile, THEME_ICON } from "../components/icons.jsx";
import LegalModal from "../modals/LegalModal.jsx";
import { THEME_CHOICES, THEME_LABEL } from "../utils/storage.js";
import { isValidEmail, formatDate } from "../utils/format.js";
import { APP_VERSION, SUPPORT_EMAIL } from "../utils/legal.jsx";
import { GOOGLE_CONFIGURED, GOOGLE_COMING_SOON } from "../utils/google.js";
import { FS_SUPPORTED, FILE_INDEX_MAX_FILES } from "../utils/fileIndex.js";

const TIER_LABEL = { trial: "Trial", smart: "Smart", basic: "Basic" };
const TIER_BADGE_CLASS = { trial: "badge-amber", smart: "badge-green", basic: "badge-gray" };

export default function SettingsView({
  folders,
  folderStatus,
  indexing,
  themeChoice,
  onSetTheme,
  onAddFolder,
  onRemoveFolder,
  onRefreshFolder,
  userEmail,
  onUpdateEmail,
  notifPerm,
  onRequestNotif,
  onExportData,
  onDeleteAll,
  onDeleteAccount,
  googleConnected,
  googleBusy,
  googleAutoExport,
  googleShowCalendar,
  onGoogleConnect,
  onGoogleDisconnect,
  onSetGoogleAutoExport,
  onSetGoogleShowCalendar,
  onExportCalendar,
  billingStatus,
  billingStatusError,
  onRetryBillingStatus,
  onStartCheckout,
}) {
  const [emailEditing, setEmailEditing] = useState(false);
  const [emailDraft, setEmailDraft] = useState(userEmail || "");
  const [emailError, setEmailError] = useState(null);
  const [legalOpen, setLegalOpen] = useState(null);

  function saveEmail() {
    const v = emailDraft.trim();
    if (v && !isValidEmail(v)) {
      setEmailError("Ungültige E-Mail-Adresse.");
      return;
    }
    onUpdateEmail(v);
    setEmailEditing(false);
    setEmailError(null);
  }

  function cancelEmailEdit() {
    setEmailDraft(userEmail || "");
    setEmailEditing(false);
    setEmailError(null);
  }

  const notifStatus =
    notifPerm === "granted"
      ? "Aktiv — Browser darf Erinnerungen zeigen"
      : notifPerm === "denied"
      ? "Blockiert — im Browser-Menü ändern"
      : notifPerm === "unsupported"
      ? "In diesem Browser nicht verfügbar"
      : "Noch nicht aktiviert";

  return (
    <div className="view">
      <header className="view-header">
        <h1>Einstellungen</h1>
        <p className="lead">
          Konto, App-Einstellungen, Datei-Freigabe und Rechtliches.
        </p>
      </header>

      {/* KONTO */}
      <section className="settings-section">
        <h2 className="settings-section-title">Konto</h2>
        <div className="settings-group">
          <div className="settings-row">
            <div className="settings-row-body">
              <div className="settings-row-label">E-Mail</div>
              {emailEditing ? (
                <>
                  <input
                    type="email"
                    className="form-input settings-inline-input"
                    value={emailDraft}
                    onChange={(e) => {
                      setEmailDraft(e.target.value);
                      setEmailError(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && saveEmail()}
                    autoFocus
                  />
                  {emailError && (
                    <div className="settings-row-error">{emailError}</div>
                  )}
                </>
              ) : (
                <div className="settings-row-value">{userEmail || "—"}</div>
              )}
            </div>
            {emailEditing ? (
              <div className="settings-row-actions">
                <button
                  type="button"
                  className="btn-secondary btn-primary-sm"
                  onClick={cancelEmailEdit}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  className="btn-primary btn-primary-sm"
                  onClick={saveEmail}
                >
                  Speichern
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn-secondary btn-primary-sm"
                onClick={() => setEmailEditing(true)}
              >
                Ändern
              </button>
            )}
          </div>
          <div className="settings-row">
            <div className="settings-row-body">
              <div className="settings-row-label">Daten exportieren</div>
              <div className="settings-row-sub">
                Alle Dokumente, Kontakte, Erinnerungen und Termine als JSON.
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary btn-primary-sm"
              onClick={onExportData}
            >
              Herunterladen
            </button>
          </div>
          <div className="settings-row">
            <div className="settings-row-body">
              <div className="settings-row-label">Alle Daten löschen</div>
              <div className="settings-row-sub">
                Setzt die App komplett zurück. Kann nicht rückgängig gemacht
                werden.
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary btn-danger btn-primary-sm"
              onClick={onDeleteAll}
            >
              Löschen
            </button>
          </div>
        </div>
      </section>

      {/* KONTO ENDGÜLTIG LÖSCHEN — bewusst eine eigene, visuell abgesetzte
          Sektion statt in "Alle Daten löschen" integriert: unterschiedliche
          Nutzerabsicht (Zurücksetzen vs. Account inkl. Login unwiderruflich
          entfernen). */}
      <section className="settings-section">
        <h2 className="settings-section-title settings-section-title-danger">
          Gefahrenzone
        </h2>
        <div className="settings-group settings-group-danger">
          <div className="settings-row">
            <div className="settings-row-body">
              <div className="settings-row-label">Konto endgültig löschen</div>
              <div className="settings-row-sub">
                Löscht deinen Account vollständig, inkl. Login und einem
                aktiven Smart-Abo (wird zuerst gekündigt). Danach ist kein
                Zugriff mehr möglich.
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary btn-danger btn-primary-sm"
              onClick={onDeleteAccount}
            >
              Löschen
            </button>
          </div>
        </div>
      </section>

      {/* APP */}
      <section className="settings-section">
        <h2 className="settings-section-title">App</h2>
        <div className="settings-group">
          <div className="settings-row">
            <div className="settings-row-body">
              <div className="settings-row-label">Design</div>
              <div className="settings-row-sub">
                „System" folgt der Einstellung deines Betriebssystems.
              </div>
            </div>
            <div className="filter-pills settings-inline-pills">
              {THEME_CHOICES.map((choice) => {
                const Icon = THEME_ICON[choice];
                return (
                  <button
                    key={choice}
                    type="button"
                    className={`pill ${themeChoice === choice ? "active" : ""}`}
                    onClick={() => onSetTheme(choice)}
                  >
                    <Icon size={13} />
                    <span>{THEME_LABEL[choice]}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-body">
              <div className="settings-row-label">Sprache</div>
            </div>
            <div className="filter-pills settings-inline-pills">
              <button type="button" className="pill active" disabled>
                Deutsch
              </button>
              <button
                type="button"
                className="pill"
                disabled
                title="Kommt bald"
              >
                English (bald)
              </button>
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-body">
              <div className="settings-row-label">Benachrichtigungen</div>
              <div className="settings-row-sub">{notifStatus}</div>
            </div>
            {notifPerm === "default" && (
              <button
                type="button"
                className="btn-secondary btn-primary-sm"
                onClick={onRequestNotif}
              >
                Aktivieren
              </button>
            )}
          </div>
        </div>
      </section>

      {/* GOOGLE */}
      <section className="settings-section">
        <h2 className="settings-section-title">Google Calendar</h2>
        {GOOGLE_COMING_SOON ? (
          <div className="settings-group">
            <div className="settings-row settings-row-muted">
              <div className="settings-row-body">
                <div className="settings-row-label">
                  Google-Kalender verknüpfen
                </div>
                <div className="settings-row-sub">
                  Fristen und Termine automatisch mit Google Calendar
                  synchronisieren — kommt bald.
                </div>
              </div>
              <span className="badge badge-gray">Coming soon</span>
            </div>
          </div>
        ) : !GOOGLE_CONFIGURED ? (
          <div className="card empty-card">
            <div className="empty-title">Noch nicht konfiguriert</div>
            <div className="empty-sub">
              Setze <code>VITE_GOOGLE_CLIENT_ID</code> in der Datei{" "}
              <code>frontend/.env</code>, damit die Verknüpfung sichtbar wird.
            </div>
          </div>
        ) : (
          <div className="settings-group">
            <div className="settings-row">
              <div className="settings-row-body">
                <div className="settings-row-label">
                  {googleConnected ? "Verbunden" : "Nicht verbunden"}
                </div>
                <div className="settings-row-sub">
                  {googleConnected
                    ? "Zugriff aktiv — Büro darf Einträge erstellen und lesen."
                    : "Melde dich mit deinem Google-Konto an, um Fristen und Termine zu synchronisieren."}
                </div>
              </div>
              {googleConnected ? (
                <button
                  type="button"
                  className="btn-secondary btn-primary-sm"
                  onClick={onGoogleDisconnect}
                  disabled={googleBusy}
                >
                  Trennen
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary btn-primary-sm"
                  onClick={onGoogleConnect}
                  disabled={googleBusy}
                >
                  {googleBusy ? "Verbinde…" : "Mit Google verbinden"}
                </button>
              )}
            </div>
            <div className="settings-row">
              <div className="settings-row-body">
                <div className="settings-row-label">
                  Neue Einträge automatisch zu Google
                </div>
                <div className="settings-row-sub">
                  Fristen, Erinnerungen und Termine werden nach dem Speichern
                  automatisch in deinen Google-Kalender geschrieben.
                </div>
              </div>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={googleAutoExport}
                  onChange={(e) => onSetGoogleAutoExport(e.target.checked)}
                  disabled={!googleConnected}
                />
                <span className="settings-switch-track" />
              </label>
            </div>
            <div className="settings-row">
              <div className="settings-row-body">
                <div className="settings-row-label">
                  Google-Termine im Kalender anzeigen
                </div>
                <div className="settings-row-sub">
                  Zeigt deine nächsten 30 Tage aus Google Calendar als
                  eigene Farbe im Kalender-Tab.
                </div>
              </div>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={googleShowCalendar}
                  onChange={(e) => onSetGoogleShowCalendar(e.target.checked)}
                  disabled={!googleConnected}
                />
                <span className="settings-switch-track" />
              </label>
            </div>
          </div>
        )}
        {!GOOGLE_COMING_SOON && (
          <p className="settings-hint">
            Deine Google-Daten verlassen nie Büro ohne deine Erlaubnis. Alle
            Aufrufe laufen direkt aus dem Browser gegen die Google API — kein
            Server dazwischen.
          </p>
        )}
      </section>

      {/* KALENDER-EXPORT (.ics) */}
      <section className="settings-section">
        <h2 className="settings-section-title">Kalender-Export</h2>
        <div className="settings-group">
          <button
            type="button"
            className="settings-row settings-row-link"
            onClick={() => onExportCalendar("all")}
          >
            <div className="settings-row-body">
              <div className="settings-row-label">Alle Einträge exportieren</div>
              <div className="settings-row-sub">
                Fristen, Erinnerungen und Termine als .ics-Datei.
              </div>
            </div>
            <IconChevron />
          </button>
          <button
            type="button"
            className="settings-row settings-row-link"
            onClick={() => onExportCalendar("deadlines")}
          >
            <div className="settings-row-body">
              <div className="settings-row-label">Nur offene Fristen</div>
              <div className="settings-row-sub">
                Nur Doc-Fristen die noch nicht erledigt sind.
              </div>
            </div>
            <IconChevron />
          </button>
          <button
            type="button"
            className="settings-row settings-row-link"
            onClick={() => onExportCalendar("reminders")}
          >
            <div className="settings-row-body">
              <div className="settings-row-label">Nur Erinnerungen</div>
              <div className="settings-row-sub">
                Alle offenen Erinnerungen als .ics-Datei.
              </div>
            </div>
            <IconChevron />
          </button>
        </div>
        <p className="settings-hint">
          Funktioniert mit Apple Kalender, Google Kalender, Outlook und allen
          anderen Kalender-Apps, die .ics-Dateien unterstützen. Auf iOS/macOS
          öffnet sich beim Antippen der Datei direkt der Apple Kalender.
        </p>
      </section>

      {/* LOKALE DATEIEN */}
      <section className="settings-section">
        <h2 className="settings-section-title">Lokale Dateien</h2>
        {FS_SUPPORTED ? (
          <>
            <p className="settings-text">
              Gib einen Ordner frei — Büro liest die Dateien darin lokal im
              Browser aus und macht alles über die Schnellsuche auffindbar.
              PDFs per PDF.js, Bilder per Tesseract-OCR (Deutsch + Englisch).
              Nichts verlässt dein Gerät.
            </p>
            <p className="settings-text">
              Max. {FILE_INDEX_MAX_FILES} Dateien pro Ordner. Bilder über 2 MB
              werden übersprungen. Der erste OCR-Aufruf lädt einmal ~15 MB
              Sprachdaten (aus Browser-Cache danach schnell).
            </p>

            {billingStatus?.tier === "basic" ? (
              // Soft-Gate: bewusst nur client-seitig, technisch für versierte
              // Nutzer umgehbar (die Indizierung selbst hat keinen Backend-
              // Call, der ihn hart durchsetzen könnte) — akzeptiert für den
              // aktuellen Maßstab. Trial/Smart bekommen den normalen Button.
              <div className="card empty-card">
                <div className="empty-title">Smart-Feature</div>
                <div className="empty-sub">
                  Lokale Datei-Freigabe ist Teil von Smart. Mit Smart
                  durchsuchst du auch deine lokalen Ordner über die
                  Schnellsuche.
                </div>
                <button
                  type="button"
                  className="btn-primary btn-primary-sm"
                  onClick={() => onStartCheckout("subscription")}
                >
                  Auf Smart upgraden
                </button>
              </div>
            ) : (
              <div className="settings-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={onAddFolder}
                  disabled={indexing.active}
                >
                  {indexing.active ? "Indiziere…" : "Ordner freigeben"}
                </button>
              </div>
            )}

            {indexing.active && (
              <div className="index-progress">
                <div className="index-progress-label">
                  {indexing.current}/{indexing.total} · {indexing.name || "…"}
                </div>
                <div className="progress">
                  <div
                    className="progress-bar bar-amber"
                    style={{
                      width: `${Math.max(4, Math.min(100, (indexing.current / Math.max(1, indexing.total)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="folder-list">
              {folders.length === 0 && !indexing.active && (
                <div className="empty">Noch keine Ordner freigegeben.</div>
              )}
              {folders.map((f) => {
                const status = folderStatus[f.id] || "unknown";
                const stale = status === "stale" || status === "missing";
                const skippedCount = f.files.filter((x) => x.skipped).length;
                return (
                  <div key={f.id} className="card folder-card">
                    <div className="folder-body">
                      <div className="folder-name-row">
                        <IconFile size={16} />
                        <span className="folder-name">{f.name}</span>
                        {stale && (
                          <span className="folder-badge">
                            {status === "missing"
                              ? "Handle verloren"
                              : "Zugriff abgelaufen"}
                          </span>
                        )}
                      </div>
                      <div className="folder-meta">
                        {f.files.length} Datei
                        {f.files.length === 1 ? "" : "en"}
                        {skippedCount > 0 &&
                          ` · ${skippedCount} übersprungen (Bild > 2 MB)`}
                        {f.indexedAt &&
                          ` · zuletzt indiziert ${formatDate(f.indexedAt)}`}
                      </div>
                    </div>
                    <div className="folder-actions">
                      {stale && status !== "missing" && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => onRefreshFolder(f.id)}
                        >
                          Zugriff erneuern
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-secondary btn-danger"
                        onClick={() => onRemoveFolder(f.id)}
                      >
                        Entfernen
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="settings-hint">
              Funktioniert nur in Chrome und Edge. Safari unterstützt die File
              System Access API nicht.
            </p>
          </>
        ) : (
          <div className="card empty-card">
            <div className="empty-title">Nicht unterstützt</div>
            <div className="empty-sub">
              Lokale Ordner können nur in Chrome oder Edge freigegeben werden.
              Safari unterstützt die File System Access API nicht.
            </div>
          </div>
        )}
      </section>

      {/* SUPPORT & FEEDBACK */}
      <section className="settings-section">
        <h2 className="settings-section-title">Support & Feedback</h2>
        <div className="settings-group">
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Feedback zu Büro")}`}
            className="settings-row settings-row-link"
          >
            <div className="settings-row-body">
              <div className="settings-row-label">Feedback senden</div>
              <div className="settings-row-sub">
                Was funktioniert? Was nervt? Schreib uns.
              </div>
            </div>
            <IconChevron />
          </a>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Feature-Idee für Büro")}`}
            className="settings-row settings-row-link"
          >
            <div className="settings-row-body">
              <div className="settings-row-label">Feature vorschlagen</div>
              <div className="settings-row-sub">
                Welche Funktion würde dir am meisten helfen?
              </div>
            </div>
            <IconChevron />
          </a>
          <div className="settings-row">
            <div className="settings-row-body">
              <div className="settings-row-label">Version</div>
            </div>
            <div className="settings-row-value settings-mono">
              v{APP_VERSION}
            </div>
          </div>
        </div>
      </section>

      {/* ABO */}
      <section className="settings-section">
        <h2 className="settings-section-title">Abo</h2>
        <div className="settings-group">
          {!billingStatus ? (
            billingStatusError ? (
              <div className="settings-row">
                <div className="settings-row-body">
                  <div className="settings-row-label">Laden fehlgeschlagen</div>
                  <div className="settings-row-sub">
                    Tarif-Status konnte nicht geladen werden. Prüfe deine
                    Internetverbindung.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary btn-primary-sm"
                  onClick={onRetryBillingStatus}
                >
                  Erneut versuchen
                </button>
              </div>
            ) : (
              <div className="settings-row">
                <div className="settings-row-body">
                  <div className="settings-row-label">Lädt…</div>
                </div>
              </div>
            )
          ) : (
            <>
              <div className="settings-row">
                <div className="settings-row-body">
                  <div className="settings-row-label">Aktueller Tarif</div>
                  <div className="settings-row-sub">
                    {billingStatus.tier === "trial" &&
                      `Voller Smart-Funktionsumfang — noch ${billingStatus.trialDaysRemaining} Tag${billingStatus.trialDaysRemaining === 1 ? "" : "e"}.`}
                    {billingStatus.tier === "smart" &&
                      "Unlimitierte Scans, Vorlagen-Erstellung und Widerspruch-Analyse."}
                    {billingStatus.tier === "basic" &&
                      `${billingStatus.scansRemaining} von 10 Gratis-Scans übrig diesen Monat.`}
                  </div>
                </div>
                <span className={`badge ${TIER_BADGE_CLASS[billingStatus.tier]}`}>
                  {TIER_LABEL[billingStatus.tier]}
                </span>
              </div>

              {billingStatus.credits > 0 && (
                <div className="settings-row">
                  <div className="settings-row-body">
                    <div className="settings-row-label">Credits</div>
                    <div className="settings-row-sub">
                      Für Scans und Vorlagen nutzbar, sobald das Gratis-Kontingent
                      aufgebraucht ist.
                    </div>
                  </div>
                  <span className="badge badge-neutral">{billingStatus.credits}</span>
                </div>
              )}

              {billingStatus.tier === "basic" && (
                <div className="settings-row">
                  <div className="settings-row-body">
                    <div className="settings-row-label">Auf Smart upgraden</div>
                    <div className="settings-row-sub">
                      Unlimitierte Scans, Vorlagen-Erstellung, Widerspruch-Analyse,
                      File System Access, erweiterter Export — 3,90€/Monat.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-primary btn-primary-sm"
                    onClick={() => onStartCheckout("subscription")}
                  >
                    Upgraden
                  </button>
                </div>
              )}

              {billingStatus.tier === "basic" && (
                <div className="settings-row">
                  <div className="settings-row-body">
                    <div className="settings-row-label">Credits nachkaufen</div>
                    <div className="settings-row-sub">
                      15 zusätzliche Scans oder Vorlagen — 0,50€ einmalig.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary btn-primary-sm"
                    onClick={() => onStartCheckout("credits")}
                  >
                    Kaufen
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* RECHTLICHES */}
      <section className="settings-section">
        <h2 className="settings-section-title">Rechtliches</h2>
        <div className="settings-group">
          <button
            type="button"
            className="settings-row settings-row-link"
            onClick={() => setLegalOpen("impressum")}
          >
            <div className="settings-row-body">
              <div className="settings-row-label">Impressum</div>
            </div>
            <IconChevron />
          </button>
          <button
            type="button"
            className="settings-row settings-row-link"
            onClick={() => setLegalOpen("datenschutz")}
          >
            <div className="settings-row-body">
              <div className="settings-row-label">Datenschutzerklärung</div>
            </div>
            <IconChevron />
          </button>
          <button
            type="button"
            className="settings-row settings-row-link"
            onClick={() => setLegalOpen("agb")}
          >
            <div className="settings-row-body">
              <div className="settings-row-label">Nutzungsbedingungen</div>
            </div>
            <IconChevron />
          </button>
          <button
            type="button"
            className="settings-row settings-row-link"
            onClick={() => setLegalOpen("widerruf")}
          >
            <div className="settings-row-body">
              <div className="settings-row-label">Widerrufsrecht</div>
            </div>
            <IconChevron />
          </button>
        </div>
      </section>

      {legalOpen && (
        <LegalModal type={legalOpen} onClose={() => setLegalOpen(null)} />
      )}
    </div>
  );
}
