const express = require("express");
const { analyzeAppeal } = require("../services/claude");
const { consumeQuota } = require("../middleware/quota");

const router = express.Router();

const MAX_DOCUMENT_TYPE_LENGTH = 200;
const MAX_SUMMARY_LENGTH = 5000;
const MAX_DEADLINE_TYPE_LENGTH = 200;

router.post("/", async (req, res, next) => {
  try {
    const { documentType, summary, deadlineType } = req.body || {};

    if (
      documentType != null &&
      (typeof documentType !== "string" || documentType.length > MAX_DOCUMENT_TYPE_LENGTH)
    ) {
      return res.status(400).json({
        error: `documentType must be a string up to ${MAX_DOCUMENT_TYPE_LENGTH} characters`,
      });
    }
    if (
      summary != null &&
      (typeof summary !== "string" || summary.length > MAX_SUMMARY_LENGTH)
    ) {
      return res.status(400).json({
        error: `summary must be a string up to ${MAX_SUMMARY_LENGTH} characters`,
      });
    }
    if (
      deadlineType != null &&
      (typeof deadlineType !== "string" || deadlineType.length > MAX_DEADLINE_TYPE_LENGTH)
    ) {
      return res.status(400).json({
        error: `deadlineType must be a string up to ${MAX_DEADLINE_TYPE_LENGTH} characters`,
      });
    }
    if (!documentType && !summary) {
      return res
        .status(400)
        .json({ error: "documentType or summary required" });
    }

    const result = await analyzeAppeal({ documentType, summary, deadlineType });
    // Quota erst nach erfolgreicher Analyse verbuchen. Smart bleibt
    // unlimitiert (consume_appeal_quota gibt reason:'unlimited' zurück,
    // ohne etwas zu zählen); Trial ist jetzt gedeckelt statt unlimitiert.
    await consumeQuota("appeal", req.accessToken);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
