# Audit: Payment/Quota-Pfad (Race Conditions, Idempotenz, Fehlerbehandlung, Edge Cases)

Scope: `backend/middleware/quota.js`, `backend/routes/{analyze,qr,template,appeal,billing,stripeWebhook}.js`,
`backend/services/{stripe,claude}.js`, `backend/index.js`.

Reiner Befund-Audit, keine Code-Änderungen vorgenommen.

Hinweis zur Methodik: Die SQL-Definitionen der RPC-Functions
(`consume_scan_credit`, `consume_template_credit`, `get_billing_status`,
`has_scan_quota`, `has_template_quota`, `apply_stripe_subscription_started`,
`apply_stripe_credits_purchased`, `apply_stripe_subscription_status`,
`log_webhook_failure`) sind nicht im Repo einsehbar (nur per Supabase
SQL-Editor eingespielt). Wo eine Einschätzung von deren internem Verhalten
abhängt, ist das explizit als **"SQL-Quelltext nicht einsehbar, Vermutung
basierend auf Aufrufer-Verhalten"** gekennzeichnet.

---

## Kritisch

### K1 — Stripe-Webhook meldet Erfolg an Stripe, obwohl der eigentliche DB-Update fehlgeschlagen ist (0 betroffene Zeilen)

**Datei/Zeilen:** `backend/routes/stripeWebhook.js:38-54` (`apply_stripe_subscription_started`),
`:55-76` (`apply_stripe_credits_purchased`), `:79-97` (`handleSubscriptionStatus` /
`apply_stripe_subscription_status`), zusammengeführt in `:104-138`
(`stripeWebhookHandler`).

**Szenario:** In allen drei Handlern gilt dasselbe Muster:

```js
if (!data?.updated) {
  console.error(...);
  await logWebhookFailure(...);
  // KEIN throw hier
}
```

Wenn die RPC zwar fehlerfrei zurückkehrt, aber `updated:false` liefert (0
Zeilen getroffen — z.B. weil `user_id`/`stripe_subscription_id` keine
passende `profiles`-Zeile findet), wird das nur geloggt. Die Funktion kehrt
danach normal zurück, der `switch`-Block in `stripeWebhookHandler` läuft
durch bis `res.json({ received: true })` — **HTTP 200 an Stripe**. Stripe
wertet das Event damit als erfolgreich zugestellt und stellt es **nicht
erneut zu**. Der Zahlungsvorgang bei Stripe ist bereits abgeschlossen (Karte
belastet / Abo aktiv bei Stripe), aber die Gutschrift/Aktivierung im eigenen
System bleibt endgültig aus — ohne automatische Selbstheilung, nur
auffindbar über `log_webhook_failure`-Einträge, falls die überhaupt aktiv
überwacht werden.

Konkret plausibler Auslöser: Ein neu registrierter Nutzer, der **noch nie
gescannt hat**, geht direkt zu Settings → "Abo abschließen"/"Credits
kaufen", ohne vorher `consume_scan_credit`/`consume_template_credit`
aufgerufen zu haben. Laut Commit `dd8ad87` wurde die On-demand-Profil-Erstellung
**explizit nur** in `consume_scan_credit`/`consume_template_credit`
eingebaut ("Backfill + consume_* legt fehlende Profile jetzt on-demand als
Basic an"), nicht in den `apply_stripe_*`-RPCs. Falls es keinen separaten
Auth-Trigger gibt, der bei Signup automatisch eine `profiles`-Zeile anlegt
(im Repo nicht nachweisbar), träfe `apply_stripe_subscription_started` bzw.
`apply_stripe_credits_purchased` bei diesem Nutzer 0 Zeilen — bezahlter
Kunde, keine Gegenleistung, Stripe denkt "erledigt".

*(SQL-Quelltext nicht einsehbar — ob ein Auth-Trigger bereits bei Signup
eine `profiles`-Zeile anlegt, konnte ich nicht verifizieren. Falls ja,
entschärft das dieses konkrete Szenario, das grundsätzliche Problem — 200 an
Stripe bei `updated:false` — bleibt aber unabhängig davon bestehen, z.B. bei
jeder anderen Ursache für 0 betroffene Zeilen.)*

**Empfehlung:** Bei `updated:false` einen Error werfen/status 500 zurückgeben
(wie beim `error`-Fall), damit Stripes eigener Retry-Mechanismus greift,
statt nur zu loggen. Zusätzlich: sicherstellen, dass jede `profiles`-Zeile
spätestens bei Checkout-Start existiert (z.B. On-demand-Erstellung auch in
`apply_stripe_*` oder ein Auth-Trigger bei Signup), damit „zahlender Kunde
ohne Profilzeile" strukturell ausgeschlossen ist.

---

### K2 — Keine Idempotenz auf /api/analyze, /api/qr (Claude-Pfad) und /api/template bei Client-Retry

**Datei/Zeilen:** `backend/routes/analyze.js:43-58`, `backend/routes/qr.js:68-103`,
`backend/routes/template.js:44-97`; `backend/middleware/quota.js` (keine
Idempotency-Key-Infrastruktur vorhanden).

**Szenario:** Diese drei Endpunkte haben keinerlei Idempotency-Key oder
Dedup-Mechanismus für wiederholte Requests derselben logischen Aktion.
Jeder POST, der den Claude-Call erfolgreich abschließt, ruft danach
unbedingt `consumeQuota()` auf und verbraucht eine Einheit. Ein Client-Retry
derselben Aktion — ausgelöst durch:

- Netzwerk-Timeout/Proxy-Timeout, während der ursprüngliche Server-Call noch
  läuft (Anthropic-SDK hat keinen expliziten Timeout gesetzt, siehe M4 —
  der Call kann deutlich länger laufen als ein typisches Reverse-Proxy-Timeout),
- Doppel-Klick auf "Scannen"/"Vorlage erstellen" vor UI-Disable,
- App-seitiger Retry-Logik nach einem wahrgenommenen Fehlschlag,

— führt zu **zwei vollständigen Claude-Calls und potenziell zwei
Credit-Abzügen** für eine einzige vom Nutzer gemeinte Aktion. Aus Nutzersicht:
"Scan ist fehlgeschlagen, nochmal versucht" kostet ihn im schlimmsten Fall
2 Credits statt 1 — das ist ein waschechter Over-Charge-Pfad, der außerhalb
der bekannten/akzeptierten Race (siehe M1) liegt, weil er nicht auf echte
Nebenläufigkeit angewiesen ist, sondern durch jeden simplen Client-Retry
ausgelöst werden kann.

**Empfehlung:** Client-generierten Idempotency-Key (z.B. UUID pro
Scan-Versuch) im Request-Header mitschicken; Backend/RPC dedupliziert
`consumeQuota`-Aufrufe mit demselben Key innerhalb eines Zeitfensters
(analog zum bereits vorhandenen `processed_stripe_events`-Muster für
Stripe-Credits). Alternativ: Request serverseitig cachen/in-flight-Dedup
pro Nutzer+Actionhash, solange der ursprüngliche Call noch läuft.

---

## Mittel

### M1 — Race Peek-vor-Consume: Bewertung des akzeptierten Restrisikos

**Datei/Zeilen:** `backend/middleware/quota.js:36-47` (`checkQuota`, Peek) und
`:56-72` (`consumeQuota`, Verbrauch nach Claude-Call).

**Bestätigung:** Die im Auftrag beschriebene Einschätzung ("Over-Grant, nie
Over-Charge") trifft nach Analyse des Aufrufer-Codes **zu**, unter einer
Bedingung, die ich nicht verifizieren kann: dass `consume_scan_credit`
und `consume_template_credit` selbst atomar sind (eine einzelne
`UPDATE ... WHERE credits > 0 RETURNING`-artige Operation, kein
Read-dann-Write in der PL/pgSQL-Funktion). Sind sie das, dann gilt exakt:
Zwei parallele Requests, die beide im `hasQuota()`-Peek `allowed:true` sehen
(weil zum Peek-Zeitpunkt noch nichts verbraucht wurde), lösen beide einen
echten Claude-Call aus (reale Anthropic-Kosten für **beide**, nicht
stornierbar), aber beim anschließenden `consumeQuota()` gewinnt nur einer
den atomaren Decrement; der zweite bekommt `allowed:false` zurück — das wird
nur geloggt (`console.warn`, Zeile 65-67), der Nutzer erhält aber **trotzdem
sein Ergebnis** (`res.json(result)` läuft unabhängig vom Consume-Ergebnis).
Nettoeffekt: Nutzer bekommt einen Scan mehr als Quota vorhanden — Over-Grant,
kein Over-Charge, exakt wie beschrieben.

**Wichtige Präzisierung / worse-than-stated-Aspekt:** Die reale Kostenseite
ist größer als "eine gratis Aktion für den Nutzer" — es sind **zwei volle
Anthropic-API-Calls**, die bezahlt werden mussten, obwohl nur einer davon
gegen Quota verrechnet wurde. Bei einem Nutzer mit vielen parallelen
Requests (z.B. Skript/Bot statt Browser) potenziert sich das: N parallele
Requests bei 1 verbleibendem Credit könnten alle den Peek passieren (kein
Lock zwischen Peek-Calls), alle N Claude-Calls auslösen, aber nur 1 Credit
verbrauchen — das ist ein Kostenrisiko (nicht Datenintegritätsrisiko), das
über die "1 zusätzlicher Scan"-Formulierung hinausgeht. In Kombination mit
K2 fehlt zudem jede Idempotenz, die das eindämmen würde.

*(SQL-Quelltext nicht einsehbar: Falls `consume_scan_credit` intern
NICHT atomar ist (z.B. separates SELECT + UPDATE ohne Row-Lock), könnte die
Race sogar zu einem negativen Credit-Stand bzw. echtem Over-Charge-Risiko
führen — das wäre der einzige Weg, wie es "schlimmer" würde als
beschrieben. Das ist der aus meiner Sicht wichtigste einzelne Punkt, der
gegen die tatsächliche SQL-Definition verifiziert werden sollte.)*

**Empfehlung:** Sofern noch nicht so implementiert, sicherstellen, dass
`consume_*`-RPCs eine einzelne atomare bedingte UPDATE-Anweisung sind. Für
das Kostenrisiko: leichtgewichtiges Locking/Dedup auf Request-Ebene (siehe
K2-Empfehlung) würde beide Probleme gleichzeitig entschärfen.

---

### M2 — `consumeQuota`-Fehler komplett verschluckt, ohne strukturiertes Monitoring

**Datei/Zeilen:** `backend/middleware/quota.js:56-72`.

**Szenario:** `consumeQuota()` fängt jeden Fehler der RPC ab und loggt nur
via `console.error`/`console.warn` — bewusst so designed, damit ein bereits
erfolgreiches Scan-Ergebnis nicht an einem nachgelagerten Quota-Fehler
scheitert (nachvollziehbar). Anders als beim Stripe-Webhook-Pfad, der ein
dediziertes `log_webhook_failure`-RPC-Muster für genau solche Fälle hat
(`stripeWebhook.js:14-26`), gibt es für `consumeQuota`-Fehler **keine**
strukturierte Ablage — nur Server-Logs. Bei einem anhaltenden Problem (z.B.
Supabase-Kurzausfall, versehentlich umbenannte RPC nach einer Migration,
falscher RPC-Name durch Copy-Paste-Fehler) bekommen **alle** Nutzer für die
Dauer des Problems unlimitierte Scans/Vorlagen, ohne dass irgendein Alarm
auslöst — das ist eine breitere Angriffs-/Fehlerfläche als die "seltene
Race zwischen zwei parallelen Requests", die als akzeptiertes Risiko
beschrieben wurde: Hier reicht ein einzelner Request während eines
Ausfalls, keine Nebenläufigkeit nötig, und der Effekt bleibt bestehen,
solange die Störung andauert (potenziell viele Nutzer, viele Aktionen).

**Empfehlung:** Gleiches Logging-Pattern wie bei Stripe-Webhooks
(`log_webhook_failure`-artige Tabelle) auch für `consumeQuota`-Fehlschläge
nutzen, plus Alerting auf gehäufte `consumeQuota`-Fehler (z.B. via
Log-basiertem Monitoring).

---

### M3 — Duplicate Stripe-Delivery bei Subscription-Events ohne expliziten Dedup-Schutz

**Datei/Zeilen:** `backend/routes/stripeWebhook.js:38-54` und `:79-97`.

**Szenario:** Nur `apply_stripe_credits_purchased` bekommt `p_event_id` zur
Dedup übergeben (Kommentar Zeile 56-58 bestätigt das explizit). Die beiden
Subscription-RPCs (`apply_stripe_subscription_started`,
`apply_stripe_subscription_status`) bekommen kein `p_event_id` und damit
keinen Dedup-Schutz auf App-Ebene. Da beide vermutlich reine `UPDATE`s auf
Statusfelder sind (kein additiver Counter), ist eine doppelte Zustellung
(Stripe liefert at-least-once) heute wahrscheinlich harmlos — erneutes
Setzen desselben Zustands ändert nichts. *(SQL-Quelltext nicht einsehbar,
daher Vermutung.)* Das Risiko: Sollte einer dieser RPCs künftig einen
Nebeneffekt bekommen, der nicht rein idempotent ist (z.B. Trial-Reset,
Mail-Versand, Audit-Log-Eintrag, Bonus-Credits bei Abo-Start), würde eine
doppelte Zustellung diesen Nebeneffekt lautlos wiederholen — es gäbe kein
strukturelles Schutznetz dagegen, anders als beim Credit-Pfad.

Verwandt (im Backlog des Nutzers bereits als offener Punkt geführt, hier
nur bestätigt statt neu gemeldet): Out-of-order-Zustellung — Stripe
garantiert keine Reihenfolge; ein spätes `customer.subscription.deleted`
nach einem neueren `customer.subscription.updated` (oder umgekehrt) könnte
den Statuszustand überschreiben in falscher Richtung, mangels
Event-Timestamp-Vergleich in `apply_stripe_subscription_status`. *(SQL nicht
einsehbar — falls die RPC bereits `event.created`/Zeitstempel vergleicht,
ist das entschärft.)*

**Empfehlung:** Einheitliches Dedup-Muster (auch `p_event_id`) für alle drei
`apply_stripe_*`-RPCs, unabhängig davon, ob es aktuell gebraucht wird —
schützt gegen künftige, nicht-idempotente Erweiterungen dieser Funktionen.

---

### M4 — Kein Timeout/Abort für Claude-Calls, kein Reagieren auf Client-Disconnect

**Datei/Zeilen:** `backend/services/claude.js:139-148` (`getClient()` — kein
`timeout`-Parameter an den `Anthropic`-Konstruktor), sowie alle Aufrufer
(`analyze.js:50`, `qr.js:96`, `template.js:84`).

**Szenario:** Der Anthropic-Client wird ohne explizites `timeout` erzeugt
und läuft damit auf SDK-Default-Verhalten (kann je nach `max_tokens`
mehrere Minuten betragen). Es gibt keinen `AbortController`, der an
`req.on('close')` gekoppelt ist — wenn der Client die Verbindung vorzeitig
abbricht (Tab geschlossen, Reverse-Proxy-Timeout kürzer als der
Claude-Call), läuft der Server-seitige Call trotzdem bis zum Ende durch,
verbraucht Anthropic-Budget für eine Antwort, die niemand mehr abholt, und
ruft anschließend `consumeQuota()` auf — der Nutzer verliert einen Credit
für einen Scan, dessen Ergebnis er nie gesehen hat (typischer Auslöser für
einen Retry und damit für K2).

**Empfehlung:** Explizites, an die erwarteten Proxy-/Client-Timeouts
angepasstes `timeout` am Anthropic-Client setzen; `AbortController` an
`req.on('close')` koppeln, um hängende Calls bei Client-Disconnect
abzubrechen und `consumeQuota` in diesem Fall zu überspringen.

---

### M5 — `/api/billing` ohne `userRateLimit`

**Datei/Zeilen:** `backend/index.js:94` — `app.use("/api/billing", ipRateLimit, requireAuth, billingRouter);`

**Szenario:** Alle anderen authentifizierten Routen (`/api/analyze`,
`/api/appeal`, `/api/qr`, `/api/template`) sind mit `ipRateLimit` **und**
`userRateLimit` gemountet. `/api/billing` hat nur `ipRateLimit`. Ein
einzelner authentifizierter Account kann `POST /api/billing/checkout`
beliebig oft aufrufen (begrenzt nur durch den geteilten IP-Zähler von 80
Requests/15min, der sich viele Nutzer hinter derselben IP teilen können) und
dabei viele Stripe-Checkout-Sessions erzeugen. Kein Datenintegritätsrisiko,
aber inkonsistent zum sonstigen Schutzmuster und unnötige Stripe-API-Last.

**Empfehlung:** `userRateLimit` auch für `/api/billing` ergänzen.

---

## Kosmetisch

### C1 — `/api/appeal` ohne jede Mengenbegrenzung außer dem generischen `userRateLimit`

**Datei/Zeilen:** `backend/index.js:74-81`, `backend/routes/appeal.js`.

`/api/appeal` hat weder `checkQuota` noch `consumeQuota` — nur
`requireTier("smart")` plus den generischen `userRateLimit` (25
Requests/15min für den ganzen Account, geteilt mit allen anderen
Endpunkten). Vermutlich bewusst so gewählt (Smart-Tier-"Flatrate"-Feature),
aber es ist der einzige Claude-kostenverursachende Endpunkt ganz ohne
credit-basierte Deckelung. Falls nicht bewusst so gewollt: kurz
gegenprüfen, ob das Kostenrisiko bei Smart-Accounts akzeptabel ist.

### C2 — `reason`-Feld in der 402-Antwort von `checkQuota` entfernt

**Datei/Zeilen:** `backend/middleware/quota.js:40` (`{ error: "quota_exceeded" }`,
ohne `reason`), während `consumeQuota` (Zeile 66) weiterhin `data?.reason`
für die Log-Nachricht nutzt. Kein Bug, nur ein Hinweis: Falls das Frontend
früher (vor Commit `dd8ad87`) den `reason`-Wert aus der 402-Antwort
ausgewertet hat, bekommt es davon jetzt nichts mehr — kurz gegenprüfen.

---

## Zusammenfassung Einordnung "Over-Grant, nie Over-Charge"

Die Aussage trifft nach Analyse des Aufrufer-Verhaltens zu — **unter der
Annahme**, dass `consume_scan_credit`/`consume_template_credit` intern
atomar implementiert sind (was ich am SQL nicht prüfen kann). Zwei
Präzisierungen: (1) die tatsächlichen Zusatzkosten treffen nicht nur den
Nutzer-Credit-Stand, sondern real das Anthropic-Budget (jeder gewonnene wie
verlorene Peek löst einen vollen, bezahlten Claude-Call aus); (2) das
Fehlen jeglicher Idempotenz (K2) bedeutet, dass der viel häufigere
Praxisfall nicht die reine Nebenläufigkeits-Race ist, sondern der simple
Client-Retry — und der kann, abhängig vom internen Verhalten der
Consume-RPC, potenziell doch zu einem gefühlten Over-Charge beim Nutzer
führen (zwei abgezogene Credits für eine gemeinte Aktion), auch wenn der
Mechanismus dahinter ein anderer ist als die ursprünglich beschriebene Race.
