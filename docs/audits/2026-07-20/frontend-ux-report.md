# Frontend-UX-Audit — Büro

Scope: `frontend/src/App.jsx`, `frontend/src/views/*.jsx`, `frontend/src/modals/*.jsx`,
`frontend/src/components/*.jsx`, `frontend/src/utils/apiFetch.js`.

Reiner Befund-Audit, keine Code-Änderungen vorgenommen.

---

## Kritisch

### 1. Initialer Datenload ohne Ladeanzeige — bei Fehler bleibt die App für immer leer
**Datei:Zeile:** `frontend/src/App.jsx:372-421` (Ladeeffekt), `frontend/src/App.jsx:1714-1716` (Render-Gate)

```js
if (!dataReady) {
  return null;
}
```

Nach Onboarding/Login läuft `fetchAll(userId)` (Zeile 377). Bis `dataReady` auf `true`
gesetzt wird, rendert die App **komplett `null`** — kein Spinner, kein Skeleton, keine
Meldung. Auf einer langsamen Verbindung sieht der Nutzer für mehrere Sekunden eine leere
weiße Seite direkt nach dem Login und kann nicht erkennen, ob die App überhaupt lädt.

Schlimmer: Der `catch`-Block dieses Effekts tut nur:
```js
} catch (e) {
  console.error("Initial data load failed:", e);
}
```
Schlägt `fetchAll` fehl (z. B. Netzwerkfehler, abgelaufenes Token, Supabase down), bleibt
`dataReady` für immer `false`. Die App zeigt dauerhaft eine leere weiße Seite — ohne
Fehlermeldung, ohne Retry-Button. Der Nutzer hat keine Möglichkeit zu erkennen, dass er
neu laden müsste.

**Empfehlung:** Lade-Skeleton/Spinner für den `!dataReady`-Zustand ergänzen; im `catch`
einen Fehlerzustand setzen (z. B. `loadError`-State) und eine sichtbare Fehlermeldung mit
"Erneut versuchen"-Button rendern statt `return null`.

### 2. "Alle Daten löschen": Cloud-Löschung kann fehlschlagen, UI meldet trotzdem Erfolg
**Datei:Zeile:** `frontend/src/App.jsx:876-917` (`deleteAllData`)

```js
if (userId) {
  try {
    await Promise.all([
      supabase.from("documents").delete().eq("user_id", userId),
      ...
    ]);
  } catch (e) {
    console.error("Cloud delete failed:", e);
  }
}
try { localStorage.clear(); } catch {}
...
location.reload();
```

Nach den zwei Bestätigungsdialogen ("Wirklich ALLE Daten löschen?") wird bei einem
Fehlschlag der Supabase-Löschung nur geloggt — der Ablauf läuft trotzdem unverändert
weiter: `localStorage.clear()`, IndexedDB löschen, `signOut()`, `location.reload()`. Der
Nutzer landet auf dem Onboarding-Screen und geht davon aus, dass wirklich **alle** Daten
gelöscht wurden. Tatsächlich können Dokumente/Kontakte/Erinnerungen/Termine serverseitig
in Supabase weiterhin existieren (z. B. bei einem kurzen Netzwerkfehler oder RLS-Problem).
Da dies eine explizit datenschutzrelevante Aktion ist (DSGVO-Löschanspruch), ist ein
stiller Fehlschlag hier besonders kritisch — der Nutzer hat keine Möglichkeit zu merken,
dass die Löschung unvollständig war.

**Empfehlung:** Bei Fehler in der Cloud-Löschung den lokalen Wipe/Reload **nicht**
automatisch fortsetzen, sondern dem Nutzer eine Fehlermeldung zeigen ("Cloud-Daten konnten
nicht gelöscht werden, bitte erneut versuchen") und die Aktion abbrechen bzw. erneut
anbieten.

---

## Mittel

### 3. Formular-`<label>`s sind nicht programmatisch mit ihren Inputs verknüpft
**Datei:Zeile:** durchgängig in `frontend/src/modals/ContactFormModal.jsx` (z. B. Zeile 47-58),
`ReminderFormModal.jsx`, `EventFormModal.jsx`, `ManualDeadlineFormModal.jsx`,
`TemplateFormModal.jsx`, `DeadlineEditModal.jsx`, `TemplateResultModal.jsx:74-81`

Beispiel (`ContactFormModal.jsx:47-58`):
```jsx
<div className="form-field">
  <label>Name *</label>
  <input type="text" className="form-input" value={form.name} ... />
</div>
```
Das `<label>` ist ein *Geschwister*-Element des `<input>`s, nicht dessen Wrapper, und es
gibt kein `htmlFor`/`id`-Pärchen (im ganzen Formular-Set nur ein einziges `htmlFor` im
gesamten Codebase, `ArchiveView.jsx:116`). Für Screenreader-Nutzer ist dadurch nicht
erkennbar, wofür ein Eingabefeld gedacht ist — sie hören nur "Textfeld, leer" statt "Name,
Pflichtfeld, Textfeld". Betrifft praktisch **alle** Formulare der App (Kontakt, Erinnerung,
Termin, manuelle Frist, Vorlagen-Anfrage).

**Empfehlung:** `<label htmlFor="...">` mit passender `id` auf dem Input verknüpfen, oder
das Input direkt in das `<label>` verschachteln (beides reicht für korrekte
Accessible-Name-Zuordnung).

### 4. `billingStatus` kann nach Stripe-Checkout-Rückkehr veraltet bleiben (Race mit Webhook)
**Datei:Zeile:** `frontend/src/App.jsx:530-536` (Redirect-Handling), `App.jsx:507-513` (dataReady-Refresh), `App.jsx:538-546` (Settings-Tab-Refresh)

Nach erfolgreichem Stripe-Checkout leitet Stripe per vollem Seiten-Reload zurück
(`?billing=success`). Die App zeigt sofort den Erfolgs-Toast "Zahlung erfolgreich — dein
Tarif wurde aktualisiert" (Zeile 535) und ruft `refreshBillingStatus()` **direkt beim
Neuladen** auf (via `dataReady`-Effekt und dem Settings-Tab-Effekt, da `setTab("settings")`
im selben Zug passiert). Die tatsächliche Tarif-Aktualisierung hängt aber vom
asynchronen Stripe-Webhook ab (`backend/routes/stripeWebhook.js`), der zu diesem Zeitpunkt
u. U. noch nicht verarbeitet wurde. Es gibt **keinen Retry/Poll**, der nachträglich prüft,
ob der Webhook inzwischen durch ist — der Nutzer sieht ggf. "Zahlung erfolgreich", aber im
Abo-Bereich weiterhin den alten Tarif (z. B. "Basic" statt "Smart"), bis er manuell den
Tab wechselt oder die Seite neu lädt.

**Empfehlung:** Nach `billingRedirect === "success"` mit kurzem Delay/Backoff (z. B.
1×2s-Retry) erneut `refreshBillingStatus()` aufrufen, oder den Erfolgstoast erst zeigen,
nachdem der neue Tarif tatsächlich vom Server bestätigt wurde.

### 5. "Weiter zu Stripe" hat keine Lade-/Doppelklick-Sperre
**Datei:Zeile:** `frontend/src/App.jsx:804-828` (`performCheckout`), `frontend/src/modals/CheckoutConsentModal.jsx:65-72`

```js
async function performCheckout(type) {
  setCheckoutConsentType(null);   // Modal schließt sofort
  ...
  const res = await authFetch(`${API_BASE}/api/billing/checkout`, ...);
  ...
  window.location.href = url;
}
```
Das `CheckoutConsentModal` wird beim Klick auf "Weiter zu Stripe" **sofort** geschlossen,
bevor der Netzwerk-Request überhaupt losgeht. Zwischen Klick und Redirect (oder Fehler-
`alert`) gibt es keinerlei sichtbares Feedback — kein Spinner, kein deaktivierter Button
(der Button existiert ja nicht mehr, das Modal ist weg). Bei langsamer Verbindung sieht
der Nutzer nur die Einstellungen-Seite ohne Hinweis, dass etwas passiert, und könnte den
Checkout-Vorgang erneut über den ursprünglichen Button starten → zwei parallele
Stripe-Checkout-Sessions.

**Empfehlung:** Modal erst nach Antwort schließen bzw. einen Lade-/Sperrzustand
(disabled-Button + Spinner-Text wie bei `TemplateFormModal`) zeigen, bis entweder der
Redirect passiert oder ein Fehler auftritt.

### 6. Hintergrund-Sync-Fehler außerhalb der Einzel-Tabellen werden nicht angezeigt
**Datei:Zeile:** `frontend/src/App.jsx:272-303`

```js
try {
  await Promise.all([syncDiff("documents", ...), ...]);
  await Promise.all([syncDiff("reminders", ...), ...]);
} catch (e) {
  console.error("sync run failed:", e);
}
```
Einzelne `syncDiff`-Fehler (z. B. Schema-Fehler) werden korrekt über `onSyncError` als
Toast angezeigt (App.jsx:262-270, `sync-error-toast` bei Zeile 2179). Schlägt aber die
gesamte Sync-Kette unerwartet fehl (z. B. Netzwerkausfall, der `syncDiff` selbst zum
Werfen bringt statt `{error}` zurückzugeben), greift nur der äußere `catch` mit
`console.error` — **kein** `syncError`-Toast, keine andere UI-Rückmeldung. Der Nutzer geht
weiter davon aus, dass seine Änderungen (Status-Toggle, neue Erinnerung etc.) mit der
Cloud synchron sind, obwohl sie es nicht sind — Risiko für scheinbaren Datenverlust bei
Gerätewechsel/Neuinstallation.

**Empfehlung:** Auch im äußeren `catch` einen `syncError`-Toast setzen (generische
Meldung "Synchronisierung fehlgeschlagen").

### 7. Migrations-Übernahme: Teilerfolg führt zu unsichtbarem Zwischenzustand
**Datei:Zeile:** `frontend/src/App.jsx:423-448` (`migrateLegacyData`)

```js
try {
  await bulkInsert("documents", legacy.docs, userId);
  await bulkInsert("contacts", legacy.contacts, userId);
  await bulkInsert("reminders", legacy.reminders, userId);
  await bulkInsert("events", legacy.events, userId);
  // Merge into current state
  ...
  setDocs((prev) => [...legacy.docs, ...prev]);
  ...
} catch (e) {
  alert("Übertragung fehlgeschlagen: " + e.message);
}
```
Die vier `bulkInsert`-Aufrufe laufen sequenziell. Schlägt z. B. der dritte
(`reminders`) fehl, wurden `documents` und `contacts` bereits erfolgreich nach Supabase
geschrieben — aber der lokale State (`setDocs`, `setContacts`) wird **erst nach allen vier
Aufrufen** aktualisiert, greift hier also nicht. Der Nutzer sieht nur den generischen
Alert "Übertragung fehlgeschlagen", die migrierten Dokumente/Kontakte tauchen in der
aktuellen Session nicht auf (obwohl sie serverseitig schon existieren) und
`migrationPrompt` bleibt offen — ein erneuter Versuch ist zwar dank `upsert` idempotent,
aber der Nutzer hat währenddessen keine Möglichkeit zu sehen, was von der Migration schon
"angekommen" ist.

**Empfehlung:** Entweder pro Teilschritt State aktualisieren (optimistisch, sobald ein
Insert erfolgreich war) oder im Fehlerfall klarer kommunizieren, welcher Teil bereits
übertragen wurde.

### 8. Google-Kalender-Einzelexporte scheitern komplett unsichtbar
**Datei:Zeile:** `frontend/src/App.jsx:685-699` (`exportItemToGoogle`), aufgerufen u. a. bei
`handlePostScanConfirm` (Zeile 1124-1128), `saveManualDeadline`, `saveReminder`, `saveEvent`

```js
} catch (e) {
  if (e.message === "token_expired") {
    setGoogleToken(null);
  }
  // silent for individual exports
  console.error("Google export failed:", e);
  return null;
}
```
Bewusst dokumentiert als Design-Entscheidung ("silent for individual exports"), aber real
nutzerrelevant: Bei aktivem "Automatisch zu Google exportieren" glaubt der Nutzer, dass
jede neue Frist/Erinnerung/jeder Termin in Google Calendar landet. Schlägt der Export
fehl (Token abgelaufen, Google-API-Fehler), merkt der Nutzer das nur, wenn er zufällig in
Google Calendar nachschaut — es gibt keinerlei Hinweis in der App selbst (auch kein
Badge/Reminder, dass der letzte Export fehlgeschlagen ist).

**Empfehlung:** Zumindest bei wiederholtem/erwartbarem Fehler (`token_expired`) einen
dezenten Hinweis zeigen ("Google-Synchronisierung unterbrochen — bitte neu verbinden"),
statt komplett stillzuschweigen.

### 9. `refreshBillingStatus`-Fehler bleiben unsichtbar — kein Retry
**Datei:Zeile:** `frontend/src/App.jsx:778-794`

```js
async function refreshBillingStatus() {
  if (!session?.access_token) return;
  try {
    const res = await authFetch(`${API_BASE}/api/billing/status`, {}, session.access_token);
    if (!res.ok) return;
    setBillingStatus(await res.json());
  } catch (e) {
    console.error("Failed to load billing status:", e);
  }
}
```
Bewusst als "ergänzende UI, kein Blocker" kommentiert — nachvollziehbar für einzelne
Fehlschläge. Schlägt der Call aber dauerhaft fehl (z. B. abgelaufenes Access-Token nach
langer Inaktivität, `!res.ok` bei 401), bleibt `billingStatus` unbegrenzt auf dem
zuletzt bekannten Stand. Das betrifft direkt sichtbare UI: Trial-Banner
(`billingStatus.trialDaysRemaining`), Upsell-Trigger, Tarif-Anzeige in den Einstellungen
— all das kann dauerhaft veraltet/falsch bleiben, ohne dass der Nutzer einen Hinweis auf
das zugrunde liegende Ladeproblem bekommt. Es gibt keinen Unterschied zwischen "noch nie
geladen" (`billingStatus === null`, zeigt "Lädt…" in SettingsView) und
"Ladeversuch dauerhaft fehlgeschlagen" (auch `null`, zeigt dauerhaft "Lädt…" ohne je
fertig zu werden) — Settings-Ansicht Zeile 573-578 hängt in diesem Fall permanent im
"Lädt…"-Zustand fest.

**Empfehlung:** Fehlerzustand von "lädt noch" unterscheiden (z. B. `billingStatusError`
-State) und in `SettingsView` statt endlosem "Lädt…" eine Fehlermeldung mit
Retry-Button zeigen.

---

## Kosmetisch

### 10. Schwacher Fokus-Indikator bei Text-/Select-Inputs
**Datei:Zeile:** `frontend/src/App.css:1344-1347`, `:1519-1520`, `:3361-3368`

```css
.form-input:focus {
  outline: 0;
  border-color: var(--accent);
}
```
Der native Fokusring wird für alle `.form-input`-Felder (verwendet in praktisch jedem
Formular-Modal), `.onboarding-input` und `.search-input-wrap` entfernt und durch eine
reine 1px-Rahmenfarbänderung ersetzt. Für Tastaturnutzer ist damit oft schwer erkennbar,
welches Feld aktuell fokussiert ist, besonders bei geringem Kontrast zwischen
`--border`/`--accent`. Buttons selbst behalten den Browser-Default-Fokusring (kein
globales `outline: none` auf `button`), das Problem betrifft also gezielt Formularfelder.

**Empfehlung:** Zusätzlich zur Rahmenfarbe einen sichtbaren `box-shadow`/Fokusring mit
ausreichendem Kontrast ergänzen (WCAG 2.4.7 / 2.4.11), z. B.
`box-shadow: 0 0 0 3px var(--accent-a30)`.

### 11. Modal ohne Fokus-Management (kein Fokus-Trap, kein Rückfokus)
**Datei:Zeile:** `frontend/src/components/Modal.jsx:1-35`

Beim Öffnen wird der Fokus nicht explizit in das Modal gesetzt (nur einzelne Formulare
nutzen selbst `autoFocus` auf dem ersten Feld, viele Detail-Modals wie `DocumentModal`,
`AppealModal`, `ReminderDetailModal` etc. gar nicht). Es gibt keinen Fokus-Trap — Tab
kann aus dem Modal heraus zu Elementen im Hintergrund springen. Beim Schließen wird der
Fokus nicht auf das auslösende Element zurückgesetzt. Für Tastatur-/Screenreader-Nutzer
erschwert das die Orientierung, ist aber kein Blocker (Escape-Taste und Klick auf
Overlay funktionieren, Zeile 6-11 bzw. 14-19).

**Empfehlung:** Beim Mount automatisch das erste fokussierbare Element fokussieren,
Tab-Zyklus auf den Modal-Inhalt begrenzen, beim Unmount Fokus auf das ursprünglich
aktive Element zurücksetzen.

---

## Positiv vermerkt (zur Einordnung)

- Alle vier credit-verbrauchenden Backend-Routen (`/api/analyze`, `/api/qr`,
  `/api/appeal`, `/api/template`) haben konsistente 402-Behandlung auf Frontend-Seite
  (`ScanView.jsx:54-57`/`113-116`, `AppealModal.jsx:36-39`, `App.jsx:1461-1467` für
  `submitTemplateRequest`) — kein state-verändernder Call ohne Upsell-Anbindung gefunden.
- `TemplateFormModal`, `AppealModal` und `ScanView` haben durchgängig Lade-Zustände
  (Spinner/Disabled-Buttons/Statustext) für ihre jeweiligen API-Calls.
- Icon-only-Buttons wie `CardMenu`, `Sidebar`-Suche/Theme-Toggle, `Modal`-Schließen und
  der Sync-Error-Close-Button haben durchweg korrekte `aria-label`s.
- Keine `onClick`-Handler auf nicht-interaktiven `<div>`-Elementen gefunden (bis auf den
  unkritischen Stop-Propagation-Wrapper in `Modal.jsx:20`) — Tastaturbedienbarkeit über
  Buttons ist durchgängig gegeben.
- `bulkInsert`/`syncDiff` nutzen durchweg `upsert` (id-basiert), wiederholte
  Migrations-/Sync-Versuche erzeugen keine Duplikate.
