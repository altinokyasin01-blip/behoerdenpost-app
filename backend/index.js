require("dotenv").config();

const express = require("express");
const cors = require("cors");
const analyzeRouter = require("./routes/analyze");
const appealRouter = require("./routes/appeal");
const qrRouter = require("./routes/qr");
const templateRouter = require("./routes/template");
const billingRouter = require("./routes/billing");
const stripeWebhookHandler = require("./routes/stripeWebhook");
const requireAuth = require("./middleware/requireAuth");
const { ipRateLimit, userRateLimit } = require("./middleware/rateLimit");
const { checkQuota, requireTier } = require("./middleware/quota");

const app = express();
const PORT = process.env.PORT || 3001;

// Railway sits in front of this app as a reverse proxy — without this,
// req.ip would resolve to the proxy's address for every request, making
// the IP-based rate limiter below bucket all traffic together.
app.set("trust proxy", 1);

// FRONTEND_URL ist bereits für die Stripe-Checkout-Redirects gesetzt (siehe
// routes/billing.js) -- wiederverwendet statt eines neuen Env-Vars.
// Komma-getrennt für den Fall mehrerer legitimer Origins (z.B. eigene
// Domain zusätzlich zu Vercel, sobald die DNS-Lage dort geklärt ist).
// Trailing Slash abschneiden -- ein Origin-Header hat nie einen, ein per Hand
// gepflegter Env-Var potenziell schon; ohne Normalisierung würde ein
// abweichender Env-Wert die komplette Produktions-App stillschweigend
// aussperren statt nur die Absicherung zu verschärfen.
const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Kein Origin-Header (z.B. curl, Server-zu-Server, der separat
    // gemountete Stripe-Webhook) -- durchlassen, hier geht es nur um
    // Browser-CORS, nicht um Auth (die läuft weiterhin über requireAuth).
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ""))) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
}));

// MUSS vor express.json() registriert werden: Stripes constructEvent()
// braucht die unveränderten Roh-Bytes des Bodys für die Signaturprüfung.
// Steht deshalb bewusst außerhalb der /api/billing-Router-Kette (die läuft
// hinter requireAuth, ein Stripe-Webhook hat aber kein User-JWT) und vor
// dem globalen JSON-Parser unten.
app.post(
  "/api/billing/webhook",
  ipRateLimit,
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

app.use(express.json({ limit: "20mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(
  "/api/analyze",
  ipRateLimit,
  requireAuth,
  userRateLimit,
  checkQuota("scan"),
  analyzeRouter
);
app.use(
  "/api/appeal",
  ipRateLimit,
  requireAuth,
  userRateLimit,
  requireTier("smart"),
  appealRouter
);
// Kein checkQuota-Middleware hier: /api/qr gated INNERHALB der Route, damit
// ein deterministisch geparster GiroCode (kein Claude-Call) komplett
// quota-frei bleibt. Nur der Claude-Pfad (Nicht-GiroCode) prüft/verbraucht.
app.use("/api/qr", ipRateLimit, requireAuth, userRateLimit, qrRouter);
app.use(
  "/api/template",
  ipRateLimit,
  requireAuth,
  userRateLimit,
  checkQuota("template"),
  templateRouter
);
app.use("/api/billing", ipRateLimit, requireAuth, billingRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

app.listen(PORT, () => {
  console.log(`Büro backend listening on http://localhost:${PORT}`);
});
