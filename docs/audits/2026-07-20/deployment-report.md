# Deployment- & Config-Audit — Büro-App

Scope: `backend/`, `frontend/` (Vite/Vercel-Config, Service Worker), ENV-Handling,
hardcodierte URLs/Domains. Reine Code-/Config-Analyse, kein Zugriff auf
Railway-/Vercel-/Supabase-Dashboards. Keine `.github/`-Workflows im Repo vorhanden
(kein CI/CD-Pipeline-Code zu prüfen).

Stand der Analyse: 2026-07-20.

---

## Kritisch

### K1 — Fehlende Startup-Validierung kritischer ENV-Variablen im Backend
**Datei:** `backend/index.js` (gesamte Datei, insb. Zeile 1–16)

`index.js` liest nirgends proaktiv `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_WEBHOOK_RPC_SECRET` oder `FRONTEND_URL` beim Start und bricht nicht mit
einer klaren Meldung ab, wenn eine fehlt. Das Verhalten ist uneinheitlich und
teils gefährlich:

- `middleware/requireAuth.js:3-6` und `routes/stripeWebhook.js:7` rufen
  `createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)` auf
  **Modul-Ladezeit** auf (beim `require(...)` in `index.js`). Fehlt
  `SUPABASE_URL`, wirft der Supabase-Client eine technische Exception
  ("supabaseUrl is required") und der Prozess crasht sofort beim Start — das
  ist zwar ein Fail-Fast, aber die Fehlermeldung kommt aus einer
  Drittbibliothek, nicht aus eurem eigenen, dokumentierten Check.
- `services/claude.js:141-144` und `services/stripe.js:5-9` prüfen erst
  **lazy beim ersten Aufruf** (`getClient()`), ob `ANTHROPIC_API_KEY` bzw.
  `STRIPE_SECRET_KEY` gesetzt sind. Der Server startet klaglos, akzeptiert
  Requests, und erst beim ersten `/api/analyze`- bzw. Checkout-Call kommt ein
  500er. Auf Railway heißt das: Health-Check (`/api/health`, Zeile 62-64)
  meldet "ok", das Deploy gilt als erfolgreich — der eigentliche Fehler zeigt
  sich erst live bei echten Nutzern.
- **`FRONTEND_URL` fehlt komplett lautlos ab:** `index.js:31-34` baut
  `allowedOrigins` aus `(process.env.FRONTEND_URL || "").split(",")...`. Ist
  die Variable nicht gesetzt, wird `allowedOrigins` zu `[]`, und **jede**
  Browser-Anfrage wird von der CORS-Middleware (Zeile 36-46) abgelehnt
  ("Not allowed by CORS"). Kein Crash, kein Log beim Start — das Frontend
  zeigt einfach durchgängig fehlschlagende Fetches, ohne dass im
  Backend-Log ein offensichtlicher Konfigurationsfehler auftaucht (nur die
  generische CORS-Fehlermeldung pro Request).
- `STRIPE_WEBHOOK_RPC_SECRET` (`routes/stripeWebhook.js:9`) wird ungeprüft in
  RPC-Aufrufe eingesetzt (`p_webhook_secret: RPC_SECRET`); ist sie `undefined`,
  scheitern vermutlich alle Stripe-Webhook-RPCs mit einem Datenbankfehler statt
  einer verständlichen Meldung.

**Ausfallszenario:** Ein Redeploy auf Railway mit versehentlich gelöschter/nicht
übernommener ENV-Variable (z.B. nach Secret-Rotation oder Umzug auf ein neues
Railway-Projekt) führt entweder zu einem sofortigen, aber kryptischen Crash-Loop
(SUPABASE_URL fehlt) oder — schlimmer — zu einem scheinbar gesunden Service, der
alle Kern-Features (Scan, Checkout, Webhook) erst beim ersten echten Nutzer-Request
sichtbar bricht (ANTHROPIC_API_KEY/STRIPE_SECRET_KEY fehlen), oder zu einer
kompletten, stillen CORS-Sperre des gesamten Frontends (FRONTEND_URL fehlt).

**Empfehlung:** Ein zentraler Startup-Check ganz oben in `index.js` (vor
`app.listen`), der alle Pflicht-ENV-Variablen auflistet, fehlende sammelt und
mit `console.error(...)` + `process.exit(1)` klar benennt, bevor der Server
überhaupt einen Port öffnet. Railways Health-Check würde den Service dann gar
nicht erst als "up" markieren, statt ihn scheinbar gesund, aber funktional
kaputt laufen zu lassen.

---

### K2 — Kein Fallback/Fehlerzustand im Frontend, wenn der initiale Datenload dauerhaft fehlschlägt
**Datei:** `frontend/src/App.jsx:372-421` (Load-Effect), `App.jsx:1714-1716`
(Render-Gate)

`fetchAll(userId)` (Aufruf Zeile 377, importiert aus `frontend/src/supabase.js`)
lädt beim Login alle Nutzerdaten von Supabase. Schlägt das dauerhaft fehl (Supabase
nicht erreichbar, Netzwerk down, abgelaufenes Token das nicht sauber behandelt
wird, o.ä.), passiert Folgendes:

```
} catch (e) {
  console.error("Initial data load failed:", e);
}
```
(Zeile 414-416) — der Fehler wird nur in die Browser-Konsole geloggt.
`setDataReady(true)` (Zeile 389) wird **nie** erreicht.

Der Root-Render-Gate:
```
if (!dataReady) {
  return null;
}
```
(Zeile 1714-1716) rendert daraufhin **dauerhaft `null`** — ein komplett weißer
Bildschirm, ohne Fehlermeldung, ohne Retry-Button, ohne Spinner (auch der
Ladezustand selbst zeigt nichts an, `null` ist einfach leer).

Zusätzlich existiert **im gesamten Frontend kein React Error Boundary**
(`grep` nach `componentDidCatch`/`getDerivedStateFromError`/`ErrorBoundary` in
`frontend/src` liefert keine Treffer). Jede unbehandelte Exception irgendwo im
Render-Baum (z.B. durch eine unerwartete Datenform aus Supabase) führt zum
selben Ergebnis: weißer Bildschirm ohne jeden Hinweis für den Nutzer.

**Ausfallszenario:** Supabase hat einen kurzen Ausfall oder Rate-Limit-Moment
genau in dem Moment, in dem ein Nutzer die App öffnet/neu lädt (z.B. nach einem
Cold-Start-Wettlauf oder einem Rolling-Restart). Die App bleibt komplett weiß
hängen; der einzige Ausweg für den Nutzer ist "zufällig" ein Reload, ohne dass
die App das je vorschlägt.

**Empfehlung:**
1. Einen simplen React Error Boundary um den App-Baum legen, der mindestens
   "Etwas ist schiefgelaufen — Seite neu laden" mit einem Reload-Button zeigt.
2. Den `catch`-Block in Zeile 414-416 um einen sichtbaren Fehlerzustand
   (State + UI statt nur `console.error`) mit Retry-Möglichkeit erweitern,
   statt den Nutzer stillschweigend auf `dataReady=false` festzunageln.

---

## Mittel

### M1 — `VITE_API_URL` fällt bei fehlender ENV-Variable lautlos auf Same-Origin zurück
**Datei:** `frontend/src/config.js:1`

```js
const API_BASE = import.meta.env.VITE_API_URL || "";
```

Fehlt `VITE_API_URL` im Vercel-Projekt (z.B. vergessen bei einem neuen
Preview-/Staging-Environment oder nach einem Projekt-Rename), wird `API_BASE`
zu einem leeren String. Alle `authFetch(API_BASE + "/api/...", ...)`-Aufrufe
gehen dann als relative Pfade an die **Vercel-Domain selbst**, die keine
`/api/*`-Routen hat → 404 vom statischen Hosting (nicht vom Backend), ohne
jeden Hinweis, dass eigentlich eine Backend-URL fehlt. Zur Bestätigung: das
lokale `frontend/.env` im Repo hat aktuell selbst kein `VITE_API_URL` gesetzt
(nur `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`) — der Fallback greift also
schon im Alltag, nicht nur im Fehlerfall.

**Ausfallszenario:** Neues Vercel-Preview-Deployment/Branch ohne
`VITE_API_URL` in den Environment-Variablen (Vercel vererbt ENV-Vars nicht
automatisch über alle Environments hinweg) → alle API-Calls schlagen mit
generischem 404 fehl, der Nutzer sieht nur `Fehler: HTTP 404` in der
Scan-Ansicht (`ScanView.jsx:60,119`) ohne Hinweis auf die eigentliche Ursache.

**Empfehlung:** Beim Fehlen von `VITE_API_URL` im Prod-Build (`import.meta.env.PROD`)
eine deutliche Konsolen-Warnung/Fehlerbanner ausgeben, analog zum bestehenden
`AuthConfigMissingScreen.jsx`-Muster für fehlende Supabase-Config.

### M2 — Kein Client-seitiges Timeout/Abort bei API-Calls
**Datei:** `frontend/src/utils/apiFetch.js:4-8`, alle Call-Sites (z.B.
`frontend/src/views/ScanView.jsx:47,104`)

`authFetch` reicht `fetch()` unverändert durch — kein `AbortController`, kein
Timeout. Ein hängender Request (Cold-Start des Backends auf Railway, ein
langsamer Claude-Call, ein Netzwerk-Hänger) lässt den `uploading`/`analyzingQr`-
State (`ScanView.jsx:28-29`) unbegrenzt lange auf `true` stehen — die UI zeigt
`"Analysiere…"` potenziell für Minuten ohne Abbruchmöglichkeit für den Nutzer.

**Ausfallszenario:** Railway rollt einen neuen Container-Restart genau während
ein Nutzer einen Scan hochlädt; die Verbindung hängt, bis der Browser selbst
(sehr lange, browserabhängige Defaults) abbricht. Der Nutzer hat keine
Möglichkeit, den Vorgang manuell abzubrechen und es erneut zu versuchen.

**Empfehlung:** `AbortController` mit einem sinnvollen Timeout (z.B. 30-60s je
nach erwarteter Claude-Latenz) in `authFetch` einbauen und dem Nutzer bei
Timeout eine klare "Zeitüberschreitung, bitte erneut versuchen"-Meldung zeigen.

### M3 — Kein globaler Crash-Schutz im Backend-Prozess
**Datei:** `backend/index.js` (gesamte Datei)

Es gibt keine `process.on("uncaughtException", ...)` oder
`process.on("unhandledRejection", ...)`-Handler. Der Express-Error-Handler
(Zeile 96-101) fängt nur Fehler, die innerhalb der Middleware-Kette per
`next(err)` durchgereicht werden. Ein synchroner Fehler außerhalb dieser Kette
oder eine nicht abgefangene Promise-Rejection (z.B. in einem versehentlich
nicht-`await`-eten Aufruf) crasht den kompletten Node-Prozess ohne Log-Kontext
über den Grund, und alle **gerade laufenden** Requests anderer Nutzer werden
hart abgebrochen (Railway startet den Container danach neu — kurzer,
kompletter Ausfall für alle gleichzeitig verbundenen Nutzer).

**Empfehlung:** Mindestens defensives Logging via
`process.on("unhandledRejection", ...)` ergänzen, damit ein solcher Fall im
Log sichtbar wird statt als stiller Container-Restart zu erscheinen.

### M4 — Stale-Chunk-Risiko beim Redeploy während offener Session (PWA/Code-Splitting)
**Dateien:** `frontend/src/utils/loaders.js:71-77` (`getJsQR`, dynamisches
`import("jsqr")`), `frontend/public/sw.js:1-25`,
`frontend/scripts/inject-sw-version.js`

Der Service Worker nutzt `self.skipWaiting()` (sw.js:11) und
`self.clients.claim()` (sw.js:23) — eine neue SW-Version übernimmt **sofort**
die Kontrolle über bereits offene Tabs, ohne dass der Nutzer die Seite neu
lädt. Das ist grundsätzlich sinnvoll für schnelle Updates, hat aber eine Lücke:
Der einzige dynamische Import im Bundle ist `import("jsqr")` in
`loaders.js:74`, der als eigener, content-gehashter Chunk gebaut wird. Öffnet
ein Nutzer die App, bleibt der Tab offen, und wird in der Zwischenzeit neu
deployed (Vercel serviert an der Produktions-Domain nur die Assets des
aktuellen Deployments), zeigt der Tab weiterhin die alte `index.html`/altes
JS-Bundle. Nutzt der Nutzer jetzt den QR-Scanner, versucht der Browser den
**alten** Chunk-Dateinamen zu laden (`/assets/jsqr-<alter-hash>.js`), der auf
der neuen Deployment-Version nicht mehr existiert → 404 beim dynamischen
Import, QR-Scan bricht mit einem für den Nutzer nicht nachvollziehbaren Fehler
ab (kein spezifischer Catch/Fallback-Text dafür in
`frontend/src/modals/QrScannerModal.jsx` bzw. `frontend/src/utils/qrScan.js`
über das generische `catch`-Handling hinaus).

Die eigentliche Cache-Invalidierung selbst ist sauber gelöst: `CACHE_NAME`
wird pro Build über den Content-Hash der `dist/assets`-Dateien neu gesetzt
(`inject-sw-version.js:19-29`), alte Caches werden beim `activate` gelöscht
(sw.js:14-25), und `/api/*`-Requests werden explizit nie gecacht
(sw.js:33) — es besteht also **kein** Risiko, dass API-Antworten fälschlich
gecacht werden.

**Ausfallszenario:** Nutzer hat die App seit längerem offen (PWA im
Standalone-Modus wird oft tagelang nicht geschlossen), es gab zwischenzeitlich
einen Deploy, Nutzer scannt jetzt einen QR-Code → Fehler statt Funktion, ohne
erkennbaren Grund oder Hinweis auf "bitte App neu laden".

**Empfehlung:** Entweder (a) den dynamischen Import mit einem Catch versehen,
der bei Chunk-Load-Fehler gezielt `location.reload()` anbietet/auslöst
("Neue Version verfügbar, bitte neu laden"), oder (b) einen
`registration.addEventListener("updatefound", ...)`-Hook einbauen, der dem
Nutzer sichtbar signalisiert, dass eine neue Version bereitsteht, statt SW und
Bundle stillschweigend auseinanderlaufen zu lassen.

---

## Kosmetisch

### C1 — Externe CDN-Skripte fest im Code verdrahtet (ohne Fallback)
**Datei:** `frontend/src/utils/loaders.js:1-3`

```js
const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const TESSERACT_URL = "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.5/tesseract.min.js";
```

Harmlos hardcodiert im Sinne von "keine Staging/Prod-Unterscheidung nötig" —
das sind Versionskonstanten, kein Deployment-Config-Wert. Fehler werden
immerhin über `loadScript()`/`getPdfJs()`/`getTesseract()` sauber als Promise-
Rejection weitergereicht (`loaders.js:14-16,27-29`). Trotzdem: kein
Self-Hosting-Fallback, kein Subresource-Integrity-Hash. Ist cdnjs kurzzeitig
nicht erreichbar (kommt vor), sind PDF-Vorschau und OCR-Fallback komplett tot,
ohne dass das an einer zentralen Stelle im eigenen Monitoring auffällt.
**Empfehlung:** Kein akuter Fix nötig, aber bei Gelegenheit über Self-Hosting
dieser beiden Bibliotheken (via npm statt CDN-`<script>`-Tag) nachdenken —
spart zusätzlich den externen Dependency-Punkt.

### C2 — `GOOGLE_COMING_SOON`-Flag als Code-Konstante statt ENV-Var
**Datei:** `frontend/src/utils/google.js:13`

```js
export const GOOGLE_COMING_SOON = true;
```

Bewusst so kommentiert im Code ("Temporär... auf false setzen, um
freizuschalten"). Funktional unkritisch, da es nur eine UI-Sichtbarkeits-
Fahne ist (kein Sicherheits- oder Deployment-Risiko), aber ein Flag wie dieses
zwingt zu einem Rebuild/Redeploy für einen reinen Sichtbarkeits-Toggle. Wenn
solche Flags häufiger werden, wäre eine `VITE_`-ENV-Var oder ein Remote-Config-
Mechanismus komfortabler. Aktuell kein Handlungsbedarf.

### C3 — Dependencies leicht hinter Latest, aber keine Sicherheits-relevanten Ausreißer
**Dateien:** `backend/package.json`, `frontend/package.json`

`npm outdated` zeigt nur unkritische Patch-/Minor-Rückstände
(`@anthropic-ai/sdk` 0.110→0.112, `@supabase/supabase-js` 2.110.0→2.110.7,
`dotenv` 16→17, `express-rate-limit` 8.5→8.6, `stripe` 22.3.1→22.3.2,
`@vitejs/plugin-react` 4.7→6.0, `vite` 7.3→8.1, `react`/`react-dom` 18.3→19.2).
Kein einziges Paket ist auf einer offensichtlich unsicheren/unsupported
Major-Version stecken geblieben (z.B. kein `express@3`, kein `react@16` o.ä.).
`express` ist auf 4.x statt 5.x, was für ein produktives Backend völlig
normal und weiterhin gepflegt ist. **Kein akuter Handlungsbedarf**, ggf.
gelegentliches `npm update` für die Patch-Versionen.

---

## Positiv vermerkt (kein Fund, zur Einordnung)

- `backend/index.js:18-21` setzt korrekt `app.set("trust proxy", 1)` für den
  Betrieb hinter Railways Reverse-Proxy — ohne das wäre der IP-Rate-Limiter
  wirkungslos (alle Requests würden auf die Proxy-IP gebucketed).
- Der Stripe-Webhook-Endpunkt (`index.js:53-58`) ist korrekt **vor**
  `express.json()` mit `express.raw()` gemountet — notwendig für die
  Signaturprüfung, ein häufiger Stolperstein.
- Service-Worker cached bewusst keine `/api/*`-Requests (`sw.js:33`) — kein
  Risiko einer fälschlich gecachten API-Antwort.
- `CACHE_NAME` wird automatisiert pro Build aus dem Content-Hash der Assets
  abgeleitet (`inject-sw-version.js`) statt manuell gepflegt — verhindert
  vergessene Versionsbumps.
- `.env`-Dateien sind korrekt in `.gitignore` und nicht im Git-Tracking
  (verifiziert via `git ls-files`).
