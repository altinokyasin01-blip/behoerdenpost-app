const express = require("express");
const multer = require("multer");
const { analyzeDocument } = require("../services/claude");

const router = express.Router();

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error(`Unsupported file type: ${file.mimetype}`);
      err.status = 400;
      cb(err);
    }
  },
});

// Normalizes Multer's own errors to the right HTTP status before they'd
// otherwise hit the global handler's `err.status || 500` fallback — a wrong
// file type or oversized upload is a client input error, not a server bug.
function handleUploadErrors(err, _req, res, next) {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File too large (max 15 MB)" });
  }
  if (err && err.status) {
    return res.status(err.status).json({ error: err.message });
  }
  next(err);
}

router.post("/", upload.single("document"), handleUploadErrors, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded (field 'document')" });
    }

    const base64 = req.file.buffer.toString("base64");
    const result = await analyzeDocument(base64, req.file.mimetype);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
