const express = require("express");
const { analyzeQrContent } = require("../services/claude");
const { parseGiroCode } = require("../services/giroCode");

const router = express.Router();

function formatEuro(n) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

// Deterministic response for a successfully parsed GiroCode — bypasses
// Claude entirely for this format (reliable, no IBAN-digit transcription
// risk, cheaper/faster than a round-trip). Same response shape
// analyzeQrContent() returns, so PostScanModal/buildDocFromResult don't
// need to know which path produced it.
function buildGiroCodeResult(content, giro) {
  const actions = [];
  if (giro.amount != null) {
    actions.push({
      type: "amount",
      label: `Betrag notieren: ${formatEuro(giro.amount)}`,
      value: giro.amount,
      priority: "high",
    });
  }
  actions.push({
    type: "contact",
    label: `Kontakt anlegen: ${giro.name}`,
    value: {
      name: giro.name,
      iban: giro.iban,
      bic: giro.bic || "",
      notes: giro.reference
        ? `GiroCode-Referenz: ${giro.reference}`
        : "Erkannt aus GiroCode (QR-Code)",
    },
    priority: "medium",
  });
  if (giro.reference) {
    actions.push({
      type: "note",
      label: `Verwendungszweck: ${giro.reference}`,
      value: giro.reference,
      priority: "medium",
    });
  }

  const summary =
    `SEPA-Überweisung an ${giro.name}` +
    (giro.amount != null ? ` über ${formatEuro(giro.amount)}` : "") +
    ".";

  return {
    documentType: "SEPA-Überweisung",
    category: "Bank",
    sender: giro.name,
    amount: giro.amount,
    summary,
    deadline: null,
    deadlineType: null,
    replyDraft: null,
    qrContent: content,
    actions,
  };
}

router.post("/", async (req, res, next) => {
  try {
    const { content } = req.body || {};
    if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "content required" });
    }
    if (content.length > 5000) {
      return res.status(400).json({ error: "content too long" });
    }
    const trimmed = content.trim();

    let result;
    if (trimmed.startsWith("BCD")) {
      const giro = parseGiroCode(trimmed);
      result = giro ? buildGiroCodeResult(trimmed, giro) : await analyzeQrContent(trimmed);
    } else {
      result = await analyzeQrContent(trimmed);
    }

    res.json({ ...result, qrCodes: [trimmed] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
