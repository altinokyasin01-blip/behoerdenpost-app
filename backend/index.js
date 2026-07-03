require("dotenv").config();

const express = require("express");
const cors = require("cors");
const analyzeRouter = require("./routes/analyze");
const appealRouter = require("./routes/appeal");
const extractRouter = require("./routes/extract");
const qrRouter = require("./routes/qr");
const templateRouter = require("./routes/template");

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

app.use("/api/analyze", analyzeRouter);
app.use("/api/appeal", appealRouter);
app.use("/api/extract", extractRouter);
app.use("/api/qr", qrRouter);
app.use("/api/template", templateRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

app.listen(PORT, () => {
  console.log(`Büro backend listening on http://localhost:${PORT}`);
});
