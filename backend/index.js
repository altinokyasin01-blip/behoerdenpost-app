require("dotenv").config();

const express = require("express");
const cors = require("cors");
const analyzeRouter = require("./routes/analyze");
const appealRouter = require("./routes/appeal");
const qrRouter = require("./routes/qr");
const templateRouter = require("./routes/template");
const requireAuth = require("./middleware/requireAuth");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: '*'
}));
app.use(express.json({ limit: "20mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use('/api/analyze', (req, res, next) => {
  console.log('Request headers:', JSON.stringify(req.headers));
  console.log('Content-Type:', req.headers['content-type']);
  next();
});

app.use("/api/analyze", requireAuth, analyzeRouter);
app.use("/api/appeal", requireAuth, appealRouter);
app.use("/api/qr", requireAuth, qrRouter);
app.use("/api/template", requireAuth, templateRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

app.listen(PORT, () => {
  console.log(`Büro backend listening on http://localhost:${PORT}`);
});
