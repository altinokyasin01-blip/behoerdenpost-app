// EPC069-12 ("GiroCode") — a rigid, line-based SEPA payment QR format.
// Intentionally mirrors frontend/src/utils/qrScan.js's parseGiroCode()
// exactly (same positional field extraction) — if the parsing logic ever
// needs to change, update both copies. Kept separate rather than shared
// because frontend (ESM) and backend (CommonJS) don't share a module
// system here.
function parseGiroCode(content) {
  if (!content || !content.startsWith("BCD")) return null;
  const lines = content.split("\n").map((l) => l.trim());
  // Mandatory per spec: service tag(0), version(1), charset(2), id(3),
  // BIC(4, may be blank), name(5), IBAN(6).
  if (lines.length < 7) return null;
  const bic = lines[4] || null;
  const name = lines[5] || null;
  const iban = lines[6] ? lines[6].replace(/\s/g, "") : null;
  if (!name || !iban) return null;
  const amountMatch = (lines[7] || "").match(/^EUR(\d+(?:[.,]\d{1,2})?)$/i);
  const amount = amountMatch ? Number(amountMatch[1].replace(",", ".")) : null;
  const reference = lines[10] || lines[9] || null;
  return {
    name,
    iban,
    bic,
    amount: Number.isFinite(amount) ? amount : null,
    reference,
  };
}

module.exports = { parseGiroCode };
