const express = require("express");
const { generateTemplate } = require("../services/claude");

const router = express.Router();

router.post("/", async (req, res, next) => {
  try {
    const {
      templateType,
      context,
      senderName,
      recipient,
      linkedDoc,
    } = req.body || {};
    if (typeof templateType !== "string") {
      return res.status(400).json({ error: "templateType required" });
    }
    const result = await generateTemplate({
      templateType,
      context: typeof context === "string" ? context : "",
      senderName: typeof senderName === "string" ? senderName : "",
      recipient: recipient && typeof recipient === "object" ? recipient : null,
      linkedDoc: linkedDoc && typeof linkedDoc === "object" ? linkedDoc : null,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
