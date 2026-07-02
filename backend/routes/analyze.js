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
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

router.post("/", upload.single("document"), async (req, res, next) => {
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
