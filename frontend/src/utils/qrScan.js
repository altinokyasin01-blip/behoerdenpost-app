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
  }
  await doc.destroy?.();
  return found;
}

// Never throws — QR detection is a nice-to-have enhancement, not core to the
// scan flow. Genuine failures (corrupt file, script load failure) resolve to
// an empty array. No timeout/race against slowness — callers should await
// this fully (e.g. via Promise.all) even for large multi-page PDFs.
export async function detectQrCodes(file, mimeType) {
  try {
    const jsQR = await getJsQR();
    let found;
    if (mimeType === "application/pdf") {
      found = await detectQrInPdfFile(file, jsQR);
    } else if (IMAGE_MIME_TYPES.has(mimeType)) {
      found = await detectQrInImageFile(file, jsQR);
    } else {
      return [];
    }
    return [...new Set(found)];
  } catch (e) {
    console.warn("QR detection failed:", e.message);
    return [];
  }
}
