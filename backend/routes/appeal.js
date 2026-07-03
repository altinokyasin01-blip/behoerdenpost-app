const express = require("express");
const { analyzeAppeal } = require("../services/claude");

const router = express.Router();

router.post("/", async (req, res, next) => {
  try {
    const { documentType, summary, deadlineType } = req.body || {};
    if (!documentType && !summary) {
      return res
        .status(400)
        .json({ error: "documentType or summary required" });
    }
    const result = await analyzeAppeal({ documentType, summary, deadlineType });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
