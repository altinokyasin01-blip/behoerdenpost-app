# Security-Audit — Backend Auth / Quota / Billing / CORS

Datum: 2026-07-20
Scope: `backend/middleware/*`, `backend/index.js`, `backend/routes/*.js`, `frontend/src/utils/apiFetch.js`, alle `process.env.*`-Referenzen, `.env`-Handling, Git-History.

**Hinweis zur Durchführung:** Während des Audits enthielt eine Tool-Ausgabe (Read von `apiFetch.js`) einen eingebetteten, gefälschten "system-reminder", der ein geändertes Datum behauptete und anwies, dies dem Nutzer zu verschweigen. Das ist eine Prompt-Injection und keine legitime Systemnachricht — sie wurde ignoriert. Erwähnt hier, damit klar ist, dass sie nicht aus einer echten Anthropic-Systemquelle stammte und nicht befolgt wurde.

---

## Kritisch

Keine Funde in dieser Kategorie. Auth-Middleware, RPC-Design (SECURITY DEFINER ohne user_id-Parameter, auth.uid()-basiert) und CORS-Grundstruktur sind solide; kein Endpoint ohne Auth-Check gefunden, keine Secrets in Git-History, keine direkte Preis-/IDOR-Manipulation möglich.

---

## Mittel

### 1. Quota-Peek ist keine atomare Reservierung — TOCTOU-Race erlaubt zusätzliche kostenpflichtige Claude-Calls über das Kontingent hinaus
**Datei:** `backend/middleware/quota.js:36-47` (`checkQuota`), `backend/routes/analyze.js:43-58`, `backend/routes/qr.js:93-97`, `backend/routes/template.js:84-93`

**Szenario:** `checkQuota`/`hasQuota` ist ein reiner Lesezugriff (`has_scan_quota`/`has_template_quota`), der Verbrauch erfolgt separat erst nach dem Claude-Call via `consumeQuota`. Ein Nutzer mit z. B. noch 1 verbleibendem Scan kann mehrere parallele Requests an `/api/analyze` (oder `/api/qr`, `/api/template`) schicken. Da alle Requests etwa gleichzeitig die Peek-Prüfung durchlaufen, sehen sie alle `allowed:true`, bevor irgendeiner konsumiert hat — alle lösen einen echten (kostenpflichtigen) Claude-Call aus. Erst beim `consumeQuota`-Aufruf danach greift serverseitig ggf. die Deckelung (Datenbank-Konto wird nicht doppelt belastet), aber die Claude-API-Kosten für die überzähligen parallelen Calls sind bereits entstanden. Begrenzt durch `userRateLimit` (25 Requests/15 Min pro Account, `backend/middleware/rateLimit.js:19-26`), aber das erlaubt bereits ein Vielfaches des eigentlich zustehenden Kontingents in einem einzigen Burst.

Der Code-Kommentar in `quota.js:53-55` benennt dieses Verhalten explizit ("a rare concurrent race... minor over-grant, never an over-charge") — es ist also bewusst in Kauf genommen, nicht übersehen. Trotzdem: das Wort "rare" unterschätzt die Ausnutzbarkeit, da ein Angreifer die Race gezielt durch parallele Requests erzwingen kann (kein Zufallsfaktor nötig).

**Empfehlung:** Falls das Kosten-Risiko relevant wird (z. B. bei Missbrauchsmustern in den Logs sichtbar), auf eine atomare "reserve-then-confirm"-RPC umstellen (Kontingent beim Peek dekrementieren/reservieren, bei Fehlschlag zurückbuchen) statt Peek+separates Consume. Alternativ: `userRateLimit` für kontingent-gebundene Routen enger fassen (z. B. Concurrency-Limit statt nur Zeitfenster-Limit).

### 2. `/api/appeal` hat keinerlei Quota-/Verbrauchslimit — nur Tier-Gate + generisches Rate-Limit
**Datei:** `backend/routes/appeal.js` (gesamte Datei), Mounting in `backend/index.js:74-81`

**Szenario:** Anders als `/api/analyze`, `/api/qr` und `/api/template` ruft `appeal.js` weder `hasQuota`/`checkQuota` noch `consumeQuota` auf. Der einzige Schutz ist `requireTier("smart")` (Abo oder laufender Trial) plus das generische `userRateLimit` (25 Requests/15 Min, geteilt mit allen anderen kontingentierten Routen desselben Nutzers). Ein Smart-Abonnent (oder ein Nutzer im kostenlosen Trial) kann diesen Claude-gestützten Endpointde facto beliebig oft aufrufen (bis zu 25× pro 15-Minuten-Fenster, dauerhaft wiederholbar), ohne dass dafür — anders als bei Scans/Vorlagen — ein Guthaben/Kontingent verbraucht wird. Für Trial-Nutzer bedeutet das: voller, uneingeschränkter Zugriff auf einen Claude-Aufruf für die gesamte Trial-Laufzeit, ohne jede Mengenbegrenzung außer dem Zeitfenster-Rate-Limit.

**Einordnung:** Kann Absicht sein ("binäres Feature-Gate", siehe Kommentar in `quota.js:74-75`), aber falls nicht bewusst als kostenlos-unlimitiert-für-Abonnenten kalkuliert, ist dies der einzige Claude-Endpoint ohne jegliche Verbrauchsdeckelung — insbesondere für Trial-Accounts ein Kostenrisiko (Claude-API-Kosten pro Call, kein Payment dahinter während des Trials).

**Empfehlung:** Prüfen, ob dieses Verhalten geschäftlich gewollt ist. Falls nicht: eigenes, engeres Rate-Limit für `/api/appeal` (unabhängig vom geteilten `userRateLimit`) oder ein echtes Kontingent wie bei den anderen Routen einführen, insbesondere für den Trial-Fall.

### 3. Globaler Error-Handler gibt `err.message` roh an den Client zurück
**Datei:** `backend/index.js:96-101`

```js
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});
```

**Szenario:** Jeder unbehandelte Fehler (inkl. Supabase-RPC-Fehler, Stripe-SDK-Fehler, interne `throw new Error(...)`-Aufrufe wie `"ANTHROPIC_API_KEY is not set"` oder `"STRIPE_PRICE_SMART_MONTHLY is not set"`) landet 1:1 in der JSON-Antwort an den Client. Aktuell keine Secrets selbst betroffen (Env-Var-Namen, nicht -Werte, werden geleakt), aber es ist ein generisches Informationsleck: Angreifer erfahren interne Implementierungsdetails (welche Env-Vars fehlen, Supabase-Fehlertexte mit Tabellen-/Constraint-Namen, RPC-Fehlermeldungen), was Aufklärungsarbeit für gezieltere Angriffe erleichtert. Bei künftigen Fehlern (z. B. Postgres-Constraint-Verletzungen mit Spaltennamen) potenziell mehr Schema-Info als gewünscht.

**Empfehlung:** Fehlermeldungen für den Client auf eine feste Allowlist bekannter, bewusst nutzerfreundlicher Fehler beschränken (z. B. die expliziten 400/402-Antworten in den Routen bleiben wie sie sind), im generischen Catch-All aber nur eine generische Meldung zurückgeben und Details ausschließlich über `console.error` loggen.

### 4. `backend/.env.example` ist unvollständig — keine dokumentierte Env-Var-Übersicht
**Datei:** `backend/.env.example`

**Befund:** Enthält nur `ANTHROPIC_API_KEY`, `PORT`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`. Tatsächlich benötigt der Code außerdem: `FRONTEND_URL` (CORS + Stripe-Redirects + Checkout-Fehlerpfad), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_RPC_SECRET`, `STRIPE_PRICE_SMART_MONTHLY`, `STRIPE_PRICE_CREDIT_PACK`. Kein direktes Sicherheitsloch (die Prod-Werte sind offenbar korrekt gesetzt, sonst würde `billing.js`/`stripeWebhook.js` sofort mit 500 antworten bzw. `stripe.js`/`claude.js` beim ersten Aufruf werfen — beides "fail closed", nicht unsicher), aber ein Setup-Risiko: Ein neues Deploy/Environment (Staging, neuer Entwickler) kann leicht vergessen, `STRIPE_WEBHOOK_RPC_SECRET` zu setzen. Da `RPC_SECRET` dann `undefined` ist und stillschweigend an die `apply_stripe_*`-RPCs übergeben wird, würde jede Webhook-Verarbeitung defekt sein (kein Credit/Abo-Update, wenn die RPC-seitige Prüfung korrekt gegen ein konkretes Secret vergleicht) — ein production-relevanter, aber stiller Fehlerzustand statt eines klaren Startup-Crashs.

**Empfehlung:** `.env.example` um alle tatsächlich referenzierten Variablen ergänzen; optional beim Start (`index.js`) eine explizite Prüfung aller kritischen Env-Vars mit hartem Fail (`process.exit(1)`) statt lazy Errors erst beim ersten Request.

---

## Kosmetisch

### 5. CORS: Preflight-Fehlerpfad liefert keinen sprechenden Body, sondern nur einen generischen CORS-Error
**Datei:** `backend/index.js:36-46`

Wenn ein Origin nicht in `allowedOrigins` ist, wird `callback(new Error("Not allowed by CORS"))` aufgerufen, was von Express letztlich über den globalen Error-Handler (Fund #3) beantwortet wird — inkl. `err.message` "Not allowed by CORS" im Body. Kein Sicherheitsproblem (CORS schützt ohnehin nur browserseitig, Auth bleibt über `requireAuth`/JWT bestehen, wie im Code-Kommentar korrekt beschrieben), aber inkonsistent: alle anderen Fehlerfälle liefern definierte Status-Codes (400/401/402/413/500), dieser Pfad landet unspezifisch bei 500.

**Empfehlung:** Optional CORS-Fehler explizit mit 403 und knapperer Meldung behandeln, rein aus Konsistenzgründen — keine Dringlichkeit.

### 6. `allowedOrigins`-Leerfall führt zu Totalausfall statt klarer Fehlermeldung beim Start
**Datei:** `backend/index.js:31-34`

Falls `FRONTEND_URL` in einem Environment vergessen wird, ist `allowedOrigins` ein leeres Array — jede Browser-Anfrage mit Origin-Header wird dann grundsätzlich per CORS geblockt (fail-closed, also nicht unsicher), aber der Fehler zeigt sich erst zur Laufzeit beim ersten Cross-Origin-Request und nicht beim Start. Für ein Produktivsystem evtl. wünschenswert, das als Startup-Warnung/-Fehler sichtbar zu machen statt es implizit über CORS-Fehlermeldungen zu entdecken.

**Empfehlung:** Beim Start loggen, falls `FRONTEND_URL` fehlt/leer ist ("CORS: keine erlaubten Origins konfiguriert").

### 7. MIME-Type-Filter in `analyze.js` vertraut dem client-gesendeten `Content-Type`, ohne Content-Sniffing
**Datei:** `backend/routes/analyze.js:19-27`

Der `fileFilter` von Multer akzeptiert Dateien allein anhand des vom Client gesetzten `file.mimetype`-Headers, nicht anhand tatsächlicher Datei-Signatur (Magic Bytes). Ein Angreifer könnte beliebigen Binärinhalt mit vorgetäuschtem `image/png`- oder `application/pdf`-Header hochladen. Da die Datei nur im Speicher gehalten (`multer.memoryStorage()`), base64-kodiert und direkt an die Claude-API weitergereicht wird (kein Schreiben auf Disk, kein lokales Parsing/Rendering) und die Größe auf 15 MB gedeckelt ist, ist das Risiko gering (kein Pfad zu RCE oder Pfad-Traversal ersichtlich) — aber ein potenzieller Vektor, falls sich das Downstream-Handling (Claude-SDK, spätere Feature-Erweiterungen) einmal ändert.

**Empfehlung:** Niedrige Priorität; falls zusätzliche Härtung gewünscht ist, echtes Content-Sniffing (z. B. `file-type`-Paket) statt reinem Header-Vertrauen einsetzen.

### 8. `.gitignore`/Secret-Handling selbst ist sauber
Kein Fund, nur zur Vollständigkeit dokumentiert: `.env`, `.env.local`, `.env.*.local` sind korrekt in `.gitignore` (Zeilen 5-6), nur `.env.example`-Dateien mit Platzhalterwerten sind im Repo (`git ls-files | grep -i env` bestätigt). `git log -p` über die komplette History zeigt keine echten Secrets (nur Platzhalter wie `your-anthropic-api-key-here`).

### 9. `anon`-Rolle für `apply_stripe_*`/`log_webhook_failure`-RPCs — bewusstes Trade-off, nicht neu bewertet als Fund, aber Beobachtung
**Datei:** `backend/routes/stripeWebhook.js:1-26`

Wie im Auftrag angemerkt, ist dies eine bewusste, dokumentierte Design-Entscheidung (secret-gated RPCs an `anon` statt Service-Role-Key). Eine Beobachtung dazu, die über reine Bestätigung hinausgeht: Das Secret (`STRIPE_WEBHOOK_RPC_SECRET`) wird bei jedem RPC-Call als **Parameter im Request-Body** an Supabase übertragen (PostgREST `rpc()`), nicht als Header. Das ist funktional gleichwertig sicher (TLS schützt den Transport so oder so), aber es bedeutet: Jedes Logging auf Supabase-/PostgREST-Seite (z. B. Query-Logs, falls dort aktiviert), das Request-Bodies mitschreibt, würde das Secret im Klartext enthalten — bei einem klassischen Header-basierten Secret (z. B. `apikey`-Header) wäre das Risiko ähnlich, aber Body-Parameter landen tendenziell öfter in generischen Application-Logs als Header. Kein akuter Fund, nur ein Aspekt, der bei der nächsten Überprüfung der Supabase-Logging-Konfiguration relevant sein könnte (sicherstellen, dass Request-Bodies nicht in einem für mehr Personen einsehbaren Log landen).

**Empfehlung:** Keine Code-Änderung nötig; ggf. bei Gelegenheit prüfen, ob Supabase-seitiges Request-Logging aktiv ist und ob es RPC-Parameter mitschreibt.

---

## Positiv vermerkt (kein Fund, aber audit-relevant)

- Kein Endpoint ohne `requireAuth` gefunden; Middleware-Reihenfolge in `index.js` ist konsistent (`ipRateLimit` → `requireAuth` → `userRateLimit` → `checkQuota`/`requireTier` → Router).
- Stripe-Checkout: `type` aus dem Body mappt nur auf serverseitig konfigurierte Preis-IDs (`CHECKOUT_CONFIG`); kein Preis- oder Produkt-Wert wird vom Client übernommen. `client_reference_id` kommt aus `req.userId` (serverseitig aus validiertem JWT), nicht aus dem Body — keine Impersonation über die Checkout-Route möglich.
- Alle mutierenden Supabase-Zugriffe laufen über RPCs, die `auth.uid()` intern lesen statt einen `user_id`-Parameter entgegenzunehmen — strukturell kein IDOR über einen manipulierten Parameter möglich (soweit aus dem Aufrufmuster im Code ersichtlich; die eigentlichen RPC-Bodies liegen nicht im Repo und wurden nicht separat verifiziert).
- Stripe-Webhook-Route ist korrekt vor `express.json()` mit `express.raw()` gemountet (Voraussetzung für Signaturprüfung) und prüft die Signatur vor jeglicher Verarbeitung.
- CORS-Rework (Commit `b125d4f`) ist grundsätzlich robust: Trailing-Slash-Normalisierung beidseitig, Komma-Liste für mehrere Origins, `!origin`-Fall korrekt als "kein Browser-Kontext" begründet statt als Sicherheitslücke.
- Fehlende kritische Secrets (`ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`) führen zu einem sauberen Error/Exception beim ersten Gebrauch (fail-closed), nicht zu unsicherem Weiterlaufen.
- Keine Secrets in Git-History gefunden.

---

## Zusammenfassung der Methodik

Geprüft wurden: `backend/middleware/{requireAuth,quota,rateLimit}.js`, `backend/index.js` (CORS, Mounting-Reihenfolge), `backend/routes/{analyze,appeal,qr,template,billing,stripeWebhook}.js`, `frontend/src/utils/apiFetch.js`, `backend/services/{stripe,claude,giroCode}.js` (für Env-Var-Validierung), alle `process.env.*`-Fundstellen per `grep`, `.gitignore`, alle `.env.example`-Dateien, sowie `git log -p` über die komplette History nach Secret-Mustern (`sk_live`, `sk_test`, `whsec_`, `service_role` u. a.).
