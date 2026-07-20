const express = require("express");
const { generateTemplate } = require("../services/claude");
const { consumeQuota, hashContent } = require("../middleware/quota");

const router = express.Router();

const MAX_CONTEXT_LENGTH = 5000;
const MAX_SENDER_NAME_LENGTH = 200;

// Nur diese Felder fließen in den Claude-Prompt (siehe generateTemplate) —
// alles andere wird verworfen, damit der Prompt-Umfang gedeckelt bleibt.
const RECIPIENT_FIELD_LIMITS = {
  name: 200,
  street: 200,
  zip: 20,
  city: 100,
};
const LINKED_DOC_FIELD_LIMITS = {
  title: 300,
  sender: 300,
  date: 40,
  summary: 5000,
  notes: 5000,
};

// Reduziert obj auf die Felder aus limits. Liefert { error } wenn ein
// vorhandenes Feld kein String ist oder das Längenlimit überschreitet,
// sonst { value } mit dem bereinigten Objekt (oder null, wenn leer).
function pickValidatedFields(obj, limits, label) {
  const out = {};
  for (const [field, maxLen] of Object.entries(limits)) {
    const v = obj[field];
    if (v == null) continue;
    if (typeof v !== "string" || v.length > maxLen) {
      return {
        error: `${label}.${field} must be a string up to ${maxLen} characters`,
      };
    }
    out[field] = v;
  }
  return { value: Object.keys(out).length > 0 ? out : null };
}

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
    let cleanRecipient = null;
    if (recipient && typeof recipient === "object") {
      const picked = pickValidatedFields(recipient, RECIPIENT_FIELD_LIMITS, "recipient");
      if (picked.error) return res.status(400).json({ error: picked.error });
      cleanRecipient = picked.value;
    }
    let cleanLinkedDoc = null;
    if (linkedDoc && typeof linkedDoc === "object") {
      const picked = pickValidatedFields(linkedDoc, LINKED_DOC_FIELD_LIMITS, "linkedDoc");
      if (picked.error) return res.status(400).json({ error: picked.error });
      cleanLinkedDoc = picked.value;
    }
    const result = await generateTemplate({
      templateType,
      context: context || "",
      senderName: senderName || "",
      recipient: cleanRecipient,
      linkedDoc: cleanLinkedDoc,
    });
    // Quota erst nach erfolgreicher Vorlagen-Generierung verbuchen.
    // Content-Hash der bereinigten Nutzlast als Idempotency-Key.
    const requestHash = hashContent(
      JSON.stringify({ templateType, context, senderName, recipient: cleanRecipient, linkedDoc: cleanLinkedDoc })
    );
    await consumeQuota("template", req.accessToken, requestHash);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
