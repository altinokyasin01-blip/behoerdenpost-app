const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const TESSERACT_URL = "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.5/tesseract.min.js";
const JSQR_URL = "https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js";

export function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-cdn-src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "1") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error(`Failed to load ${src}`))
      );
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.cdnSrc = src;
    s.addEventListener("load", () => {
      s.dataset.loaded = "1";
      resolve();
    });
    s.addEventListener("error", () =>
      reject(new Error(`Failed to load ${src}`))
    );
    document.head.appendChild(s);
  });
}

let pdfJsPromise = null;
export function getPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = (async () => {
      await loadScript(PDFJS_URL);
      const lib = window.pdfjsLib;
      if (!lib) throw new Error("pdf.js not available");
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return lib;
    })().catch((e) => {
      pdfJsPromise = null;
      throw e;
    });
  }
  return pdfJsPromise;
}

let tesseractPromise = null;
export function getTesseract() {
  if (!tesseractPromise) {
    tesseractPromise = (async () => {
      await loadScript(TESSERACT_URL);
      const T = window.Tesseract;
      if (!T) throw new Error("Tesseract not available");
      return T;
    })().catch((e) => {
      tesseractPromise = null;
      throw e;
    });
  }
  return tesseractPromise;
}

let jsQrPromise = null;
export function getJsQR() {
  if (!jsQrPromise) {
    jsQrPromise = (async () => {
      await loadScript(JSQR_URL);
      const fn = window.jsQR;
      if (!fn) throw new Error("jsQR not available");
      return fn;
    })().catch((e) => {
      jsQrPromise = null;
      throw e;
    });
  }
  return jsQrPromise;
}
