const express = require("express");
const { analyzeQrContent } = require("../services/claude");

const router = express.Router();

router.post("/", async (req, res, next) => {
  try {
    const { content } = req.body || {};
    if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "content required" });
    }
    if (content.length > 5000) {
      return res.status(400).json({ error: "content too long" });
    }
    const result = await analyzeQrContent(content.trim());
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
