import { getPdfJs, getJsQR } from "./loaders.js";

// QR sits almost always on page 1 of an invoice — capped lower than the
// text-extraction PDF_MAX_PAGES (fileIndex.js) since this is a different
// cost profile (render + decode per page, not just text extraction).
const QR_PDF_MAX_PAGES = 10;
const QR_RENDER_SCALE = 2; // higher resolution improves jsQR reliability

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

function decodeCanvas(canvas, jsQR) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "attemptBoth",
  });
  return code?.data || null;
}

async function detectQrInImageFile(file, jsQR) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0);
  const text = decodeCanvas(canvas, jsQR);
  return text ? [text] : [];
}

async function detectQrInPdfFile(file, jsQR) {
  const lib = await getPdfJs();
  const buf = await file.arrayBuffer();
  const doc = await lib.getDocument({ data: buf }).promise;
  const found = [];
  const pages = Math.min(doc.numPages, QR_PDF_MAX_PAGES);
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: QR_RENDER_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const text = decodeCanvas(canvas, jsQR);
    if (text) found.push(text);
    page.cleanup?.();
    // Stop after the first page with a QR code — no known multi-QR-per-PDF
    // use case, and scanning all pages regardless was the main latency cost.
    if (found.length > 0) break;
  }
  await doc.destroy?.();
  return found;
}

// EPC069-12 ("GiroCode") — a rigid, line-based SEPA payment QR format. Parsed
// deterministically here rather than asking Claude to parse it, since the
// structure is fixed and exact (no room for an LLM to misread a digit).
// Returns null if `content` isn't a GiroCode or is missing mandatory fields.
export function parseGiroCode(content) {
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

// Never throws — QR detection is a nice-to-have enhancement, not core to the
// scan flow. Genuine failures (corrupt file, script load failure) resolve to
// an empty array. No timeout/race against slowness — callers should await
// this fully (e.g. via Promise.all) even for large multi-page PDFs.
export async function detectQrCodes(file, mimeType) {
  let jsQR;
  try {
    jsQR = await getJsQR();
  } catch {
    return [];
  }

  if (mimeType === "application/pdf") {
    try {
      const found = await detectQrInPdfFile(file, jsQR);
      return [...new Set(found)];
    } catch {
      return [];
    }
  }

  if (IMAGE_MIME_TYPES.has(mimeType)) {
    try {
      return await detectQrInImageFile(file, jsQR);
    } catch {
      return [];
    }
  }

  return [];
}
