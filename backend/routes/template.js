const express = require("express");
const { generateTemplate } = require("../services/claude");

const router = express.Router();

const MAX_CONTEXT_LENGTH = 5000;
const MAX_SENDER_NAME_LENGTH = 200;

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
    if (
      context != null &&
      (typeof context !== "string" || context.length > MAX_CONTEXT_LENGTH)
    ) {
      return res.status(400).json({
        error: `context must be a string up to ${MAX_CONTEXT_LENGTH} characters`,
      });
    }
    if (
      senderName != null &&
      (typeof senderName !== "string" || senderName.length > MAX_SENDER_NAME_LENGTH)
    ) {
      return res.status(400).json({
        error: `senderName must be a string up to ${MAX_SENDER_NAME_LENGTH} characters`,
      });
    }
    const result = await generateTemplate({
      templateType,
      context: context || "",
      senderName: senderName || "",
      recipient: recipient && typeof recipient === "object" ? recipient : null,
      linkedDoc: linkedDoc && typeof linkedDoc === "object" ? linkedDoc : null,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
