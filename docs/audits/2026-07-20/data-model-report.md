# Datenmodell-Audit — Büro App

Stand: 2026-07-20. Reiner Code-/Git-History-Audit, **kein** Live-DB-Zugriff (kein `migrations/`-Ordner,
kein `DATABASE_URL`, kein Service-Role-Key verfügbar). Alle Aussagen zu tatsächlichem DB-Zustand sind
entweder durch Commit-Message-Zitate belegt ("Beweis") oder aus Code-Verhalten abgeleitet ("Vermutung").
Es wurden **keine** jemals committeten `*.sql`-Dateien gefunden (`git log --all --oneline -- '*.sql'` ist leer)
— Migrationen liefen ausschließlich manuell über den Supabase SQL-Editor, ihr Inhalt ist nur noch über
Commit-Message-Prosa rekonstruierbar.

Methodik: `git log` über alle 84 Commits nach migrations-/RLS-/Stripe-/Profile-Schlüsselwörtern durchsucht,
Backend-Routen (`backend/routes/*.js`, `backend/middleware/*.js`) und Frontend-Supabase-Layer
(`frontend/src/supabase.js`, `frontend/src/App.jsx`) gegen die dort referenzierten Tabellen/Spalten/RPCs
abgeglichen.

---

## Kritisch

### K1. Kein Beleg für Index auf `user_id` in documents/contacts/reminders/events/saved_templates
**Vermutung, aus Code-Verhalten.** `frontend/src/supabase.js` (`fetchAll`, Zeilen 186–213) filtert
**jede** Abfrage gegen diese fünf Tabellen mit `.eq("user_id", userId)` und sortiert zusätzlich nach
`created_at DESC`. Dieselbe Spalte trägt vermutlich auch die RLS-Policy-Bedingung (`auth.uid() = user_id`),
d.h. sie wird bei **jedem** Request zweimal ausgewertet (RLS-Check + WHERE-Klausel). Keine der
Migrations-Commit-Messages (`8f58a6f`, `2a13f43`, `d44b79e` etc.) erwähnt ein `CREATE INDEX`. Ohne Index
auf `user_id` (idealerweise Composite-Index `(user_id, created_at DESC)` für die Sortierung) skaliert das
nicht über Sequential Scans hinaus, sobald die Tabellen wachsen — trifft aktuell alle fünf App-Kerntabellen.
**Empfehlung:** Im SQL-Editor `\d+ documents` etc. prüfen; falls kein Index existiert, `CREATE INDEX ON
documents (user_id, created_at DESC)` (analog für contacts/reminders/events/saved_templates) nachziehen.

### K2. Stripe-Webhook-Dedup nur für Credit-Käufe, nicht für Subscription-Status-Updates
**Beweis (Code).** `backend/routes/stripeWebhook.js`: `apply_stripe_credits_purchased` bekommt `p_event_id`
zur Dedup gegen die neue Tabelle `processed_stripe_events` (laut Commit `dd8ad87` extra dafür angelegt).
`apply_stripe_subscription_started` (Zeile 39–46) und `apply_stripe_subscription_status` (Zeile 80–85)
bekommen dagegen **kein** `p_event_id` — keine Idempotenz-/Reihenfolge-Prüfung. Stripe liefert Events
"at-least-once" und **nicht garantiert in Reihenfolge**; trifft z.B. ein verzögert zugestelltes älteres
`customer.subscription.updated`-Event (Status "past_due") NACH einem neueren Event (Status "active" nach
erfolgter Nachzahlung) ein, überschreibt es den korrekten neueren Zustand — ohne dass Code oder RPC das
erkennen könnte, da kein Zeitstempel-Vergleich sichtbar ist. Deckt sich mit dem in der User-Memory
vermerkten offenen Backlog-Punkt "out-of-order-Events" (unabhängig aus dem Code hergeleitet, nicht aus der
Memory übernommen). **Kritisch**, weil es den Kern-Billing-Zustand (Zugriff auf Smart-Features) betrifft.
**Empfehlung:** `apply_stripe_subscription_status`/`_started` um einen Vergleich mit `event.created`
(Unix-Timestamp aus dem Stripe-Event) erweitern und nur anwenden, wenn neuer als der zuletzt verarbeitete
Stand — oder zusätzliche Spalte `profiles.stripe_status_updated_at` für "last write wins nur wenn neuer".

### K3. `invoice.payment_failed` wird im Webhook nicht behandelt, kein `past_due`-Handling im Code
**Beweis (Code).** `stripeWebhookHandler`s `switch (event.type)` behandelt ausschließlich
`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` — alles
andere fällt in `default: // Andere Event-Typen bewusst ignoriert.`. Eine projektweite Suche nach
`past_due` liefert **keinen einzigen Treffer** in `backend/` oder `frontend/src/`. Das bedeutet: Eine
fehlgeschlagene Kartenabbuchung für ein bestehendes Abo wird von der App gar nicht wahrgenommen, bis Stripe
irgendwann — abhängig vom Dunning-Zyklus, typischerweise Tage später — ein `customer.subscription.updated`
mit Status `past_due`/`unpaid` sendet, sofern `get_billing_status` diesen Status überhaupt von "smart"
unterscheidet (nicht verifizierbar ohne SQL-Zugriff auf die RPC-Definition). Deckt sich mit den in der
User-Memory vermerkten offenen Punkten "past_due-Kulanz" und "invoice.payment_failed" — hier unabhängig
aus dem Code bestätigt. **Kritisch**, weil ein Nutzer mit fehlgeschlagener Zahlung ggf. unbegrenzt lange
vollen Smart-Zugriff behält.
**Empfehlung:** `invoice.payment_failed` explizit behandeln (z.B. sofortiges Downgrade-Signal oder
Kulanzfrist mit Banner), und verifizieren, welche `stripe_subscription_status`-Werte `get_billing_status`
tatsächlich als "smart" vs. "basic" einstuft.

---

## Mittel

### M1. Lookup von `profiles` über `stripe_subscription_id` ohne erkennbaren Unique-Constraint
**Vermutung.** `apply_stripe_subscription_status` wird ausschließlich mit `p_stripe_subscription_id`
aufgerufen (kein `p_user_id`) — die RPC muss also intern per `WHERE stripe_subscription_id = ...` matchen.
Ohne UNIQUE-Constraint/Index auf dieser Spalte: (a) Full-Table-Scan bei jedem Subscription-Update, (b) bei
einem hypothetischen Datenfehler (z.B. manueller SQL-Editor-Edit, der zwei Profilen dieselbe
`stripe_subscription_id` zuweist) treffen `UPDATE`-Statements ggf. mehr als eine Zeile, ohne dass die App
das bemerkt (der Code prüft nur `data?.updated`, keine Anzahl betroffener Zeilen).
**Empfehlung:** `UNIQUE`-Constraint auf `profiles.stripe_subscription_id` (NULL-Werte bleiben davon
unberührt) im SQL-Editor verifizieren/nachziehen.

### M2. Keine erkennbaren CHECK-Constraints für `scans_used_this_period >= 0` / `purchased_credits >= 0`
**Vermutung.** Der gesamte Frontend-Code behandelt diese Werte durchgängig als nicht-negativ (z.B.
`ScanView.jsx`: `billingStatus.scansRemaining > 0 ? ... : billingStatus.credits > 0 ? ...`,
`SettingsView.jsx` zeigt `${billingStatus.scansRemaining} von 10 Gratis-Scans übrig`). Es gibt keinerlei
Beleg (Commit-Message oder Code) für eine DB-seitige Absicherung. Ein Bug in einer der `consume_*`/
`apply_stripe_*`-RPCs oder ein unbedachter manueller SQL-Editor-Edit könnte negative Werte erzeugen — die
UI würde das nicht crashen (die `> 0`-Vergleiche fangen es ab), aber `get_billing_status` könnte
widersprüchliche Zahlen liefern.
**Empfehlung:** `CHECK (scans_used_this_period >= 0)` und `CHECK (purchased_credits >= 0)` auf `profiles`
ergänzen, damit fehlerhafte RPC-Logik an der DB abprallt statt sich in der UI zu zeigen.

### M3. Dokumentierter Präzedenzfall für Schema-Drift zwischen Code und tatsächlicher DB (documents.source)
**Beweis (Commit `2a13f43`).** Zitat aus der Commit-Message: *"Migration: Spalte documents.source
existierte nicht im Schema (42703), musste zuerst manuell in Supabase ergänzt werden."* — Postgres-Fehler
42703 ("undefined_column") ist in Produktion aufgetreten, weil Code releast wurde, bevor die begleitende
Spalte im SQL-Editor angelegt war. Andere Felder in `docToRow`/`rowToDoc` (`recurring`, `qr_codes`,
`full_text`, `notes`, `amount`, `manual`) wurden in früheren Commits (`74075a4`, `7a417b2`, `6d10d52`,
`c0a90f3`) ergänzt, **ohne** eine vergleichbare "Spalte manuell nachgezogen"-Notiz in der Commit-Message.
Das beweist nicht, dass dort ebenfalls etwas fehlt — aber es zeigt, dass der Workflow (Code zuerst, DB-Spalte
per Hand hinterher) strukturell genau diese Klasse von Fehlern produziert, und dass der `source`-Fall
wahrscheinlich kein Einzelfall war, sondern nur der, der sichtbar in Produktion krachte.
**Empfehlung:** Einmaliger Soll-Ist-Abgleich per `information_schema.columns`-Query im SQL-Editor gegen die
vollständige Feldliste aus `docToRow`/`contactToRow`/`reminderToRow`/`eventToRow`/`savedTemplateToRow`.

### M4. `deleteDoc` orphant Reminders, aber nicht Events — Inkonsistenz, die auf fehlende FK/Cascade hindeutet
**Beweis (Code).** `frontend/src/App.jsx`:
- `deleteDoc` (Zeile 1190–1201) setzt bei zugehörigen Remindern `docId: null, orphaned: true`.
- Für Events mit demselben `docId` passiert **nichts** — die Zeile bleibt mit einer auf ein gelöschtes
  Dokument zeigenden `doc_id` bestehen, `orphaned` bleibt `false`.
- Zum Vergleich: `deleteContact` (Zeile 1627–1640) orphant korrekt alle Events mit passender `contactId`.

Das ist zum einen ein echter App-Bug (Events verweisen nach Dokumentlöschung auf eine nicht mehr
existierende `documents`-Zeile, ohne dass die UI das erkennt). Zum anderen ist es starkes indirektes
Indiz, dass `events.doc_id`/`reminders.doc_id` **keine** Foreign-Key-Constraint mit `ON DELETE SET NULL`
trägt — sonst wäre die manuelle Reminder-Orphaning-Logik redundant bzw. würde mit einer DB-seitigen
Kaskade in Konkurrenz stehen (die App setzt `docId: null` clientseitig und synct das per `syncDiff`
zurück; eine DB-Kaskade würde dasselbe serverseitig ohnehin schon erledigen).
**Empfehlung (Datenmodell-Ebene):** FK `reminders.doc_id → documents.id` und `events.doc_id → documents.id`
mit `ON DELETE SET NULL` ergänzen, damit die Konsistenz nicht allein von client-seitigem JS abhängt (das
hier nachweislich bereits einmal lückenhaft war).

### M5. "Alle Daten löschen" löscht keine `profiles`-Zeile, keinen Auth-Account, keine Stripe-Verknüpfung
**Beweis (Code).** `deleteAllData` (`App.jsx`, Zeile 876ff.) löscht ausschließlich
`documents`/`contacts`/`reminders`/`events`/`saved_templates` per `.eq("user_id", userId)`. Es gibt keinen
Aufruf, der `profiles` löscht oder den Supabase-Auth-User entfernt; `stripe_customer_id`/
`stripe_subscription_id`/`trial_started_at`/`purchased_credits` bleiben nach diesem Vorgang unverändert
erhalten, der Nutzer bleibt eingeloggt. Das passt zur Prämisse "profiles hat nur eine SELECT-Policy" — der
Code versucht konsequenterweise gar nicht erst, dort zu schreiben/löschen — bedeutet im Umkehrschluss aber
auch: Es existiert aktuell **kein** Lösch-Pfad (weder App noch erkennbare Backend-Route) für die
`profiles`-Zeile selbst oder den Auth-Account. Ob eine vollständige Konto-Löschung anderweitig (Support,
manueller SQL-Editor-Eingriff) vorgesehen ist, ist von hier aus nicht zu beurteilen — als Beobachtung
aufgenommen, nicht als bestätigter Fehler.

---

## Kosmetisch

### C1. Hartcodiertes "10 Gratis-Scans"-Limit an mehreren Frontend-Stellen
**Beweis (Code).** `ScanView.jsx:144`, `SettingsView.jsx:590` und der Trial-Banner-Text in `App.jsx:1782`
enthalten alle den Literal-Text "10 Gratis-Scans", statt den Wert aus `billingStatus`/`get_billing_status`
abzuleiten. Kein Datenmodell-Bug, aber Symptom einer fehlenden einzelnen Quelle der Wahrheit für dieses
Limit — falls der Basic-Freibetrag serverseitig in der RPC je geändert wird, muss er an mindestens drei
Frontend-Stellen manuell nachgezogen werden.

### C2. Initialer Subscription-Status wird beim Checkout hart auf "active" gesetzt
**Beweis (Code).** `handleCheckoutCompleted` in `stripeWebhook.js` (Zeile 44) übergibt
`p_stripe_subscription_status: "active"` fest verdrahtet, statt den tatsächlichen Status aus dem
Stripe-Session-/Subscription-Objekt zu lesen. Bei einem Standard-Checkout mit sofortiger Zahlung ist das in
der Praxis korrekt, deckt aber z.B. den Fall `trialing` oder `incomplete` (unvollständige Zahlungsmethode)
nicht ab, falls Stripe je mit einer solchen Konfiguration nicht sofort "active" liefert.

### C3. On-demand-Profilanlage ohne erkennbaren Signup-Trigger
**Beweis (Commit `dd8ad87`).** Laut Commit-Message legt erst der erste `consume_*`-RPC-Aufruf eine fehlende
`profiles`-Zeile "on-demand" als Basic an (`trial_started_at NULL`). Es gibt keinen Hinweis auf einen
DB-Trigger (`handle_new_user` o.ä.), der bei Registrierung automatisch eine `profiles`-Zeile mit
`trial_started_at = now()` anlegt — impliziert, dass der Trial-Start entweder an anderer Stelle explizit
gesetzt wird (nicht verifizierbar ohne SQL-Zugriff) oder dass ein brandneuer Nutzer vor seinem ersten
Scan/Vorlagen-Versuch schlicht keine `profiles`-Zeile besitzt. Als "zu prüfen" markiert, nicht als
bestätigtes Problem.

---

## Zusammenfassung der Belegstärke

| # | Fund | Beleg |
|---|------|-------|
| K1 | Fehlender Index auf `user_id` (5 Kerntabellen) | Vermutung (Code-Query-Muster) |
| K2 | Kein Event-Dedup/Reihenfolge-Schutz bei Subscription-Status-RPCs | Beweis (Code-Diff) |
| K3 | `invoice.payment_failed` unbehandelt, kein `past_due`-Pfad | Beweis (Code, `grep` ohne Treffer) |
| M1 | `stripe_subscription_id`-Lookup ohne erkennbaren Unique-Constraint | Vermutung |
| M2 | Keine CHECK-Constraints für Quota-Felder ≥ 0 | Vermutung |
| M3 | Präzedenzfall Schema-Drift (`documents.source`, Fehler 42703) | Beweis (Commit-Zitat) |
| M4 | `deleteDoc` orphant Events nicht (nur Reminders) | Beweis (Code) |
| M5 | Konto-/Profildaten bleiben bei "Alle Daten löschen" erhalten | Beweis (Code) |
| C1 | Hartcodiertes Scan-Limit an 3 Frontend-Stellen | Beweis (Code) |
| C2 | Subscription-Status beim Checkout hart auf "active" | Beweis (Code) |
| C3 | Kein erkennbarer Signup-Trigger für Trial-Start | Beweis (Commit-Zitat) + Vermutung |
