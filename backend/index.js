require("dotenv").config();

const express = require("express");
const cors = require("cors");
const analyzeRouter = require("./routes/analyze");
const appealRouter = require("./routes/appeal");
const qrRouter = require("./routes/qr");
const templateRouter = require("./routes/template");
const requireAuth = require("./middleware/requireAuth");
const { ipRateLimit, userRateLimit } = require("./middleware/rateLimit");

const app = express();
const PORT = process.env.PORT || 3001;

// Railway sits in front of this app as a reverse proxy — without this,
// req.ip would resolve to the proxy's address for every request, making
// the IP-based rate limiter below bucket all traffic together.
app.set("trust proxy", 1);

app.use(cors({
  origin: '*'
}));
app.use(express.json({ limit: "20mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/analyze", ipRateLimit, requireAuth, userRateLimit, analyzeRouter);
app.use("/api/appeal", ipRateLimit, requireAuth, userRateLimit, appealRouter);
app.use("/api/qr", ipRateLimit, requireAuth, userRateLimit, qrRouter);
app.use("/api/template", ipRateLimit, requireAuth, userRateLimit, templateRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

app.listen(PORT, () => {
  console.log(`Büro backend listening on http://localhost:${PORT}`);
});
