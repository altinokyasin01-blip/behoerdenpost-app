import { getPdfJs, getTesseract } from "./loaders.js";

export const FILE_INDEX_KEY = "buero_file_index";
export const FILE_INDEX_MAX_FILES = 50;
const FILE_INDEX_MAX_TEXT = 5000;

const EXT_TEXT_PLAIN = new Set([".txt", ".md"]);
const EXT_PDF = new Set([".pdf"]);
const EXT_IMAGE = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const PDF_MAX_PAGES = 20;

export function isSupportedFileExt(ext) {
  return EXT_TEXT_PLAIN.has(ext) || EXT_PDF.has(ext) || EXT_IMAGE.has(ext);
}

let ocrWorkerPromise = null;
function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      const T = await getTesseract();
      return T.createWorker("deu+eng");
    })().catch((e) => {
      ocrWorkerPromise = null;
      throw e;
    });
  }
  return ocrWorkerPromise;
}

async function extractPdfLocal(file) {
  const lib = await getPdfJs();
  const buf = await file.arrayBuffer();
  const doc = await lib.getDocument({ data: buf }).promise;
  const parts = [];
  const pages = Math.min(doc.numPages, PDF_MAX_PAGES);
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    parts.push(content.items.map((it) => it.str).join(" "));
    page.cleanup?.();
  }
  await doc.destroy?.();
  return parts.join("\n\n").trim();
}

async function extractImageOcr(file) {
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(file);
  return (data.text || "").trim();
}

export const FS_SUPPORTED = typeof window !== "undefined" && "showDirectoryPicker" in window;

export const IDB_NAME = "buero";
const IDB_STORE = "folder_handles";

export function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetAll() {
  if (typeof indexedDB === "undefined") return [];
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const keysReq = store.getAllKeys();
    keysReq.onsuccess = () => {
      const valReq = store.getAll();
      valReq.onsuccess = () => {
        resolve(keysReq.result.map((k, i) => ({ id: k, handle: valReq.result[i] })));
      };
      valReq.onerror = () => reject(valReq.error);
    };
    keysReq.onerror = () => reject(keysReq.error);
  });
}

export async function idbPut(id, handle) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(handle, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbDelete(id) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function fileExt(name) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

async function* walkFolder(handle, prefix = "") {
  for await (const [name, child] of handle.entries()) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (child.kind === "file") {
      yield { path, name, handle: child };
    } else if (child.kind === "directory") {
      yield* walkFolder(child, path);
    }
  }
}

async function readFileText(fileHandle, ext) {
  const file = await fileHandle.getFile();
  let text = "";
  let skipped = false;
  let skipReason = null;
  try {
    if (EXT_TEXT_PLAIN.has(ext)) {
      text = await file.text();
    } else if (EXT_PDF.has(ext)) {
      text = await extractPdfLocal(file);
    } else if (EXT_IMAGE.has(ext)) {
      if (file.size > IMAGE_MAX_BYTES) {
        skipped = true;
        skipReason = "size";
      } else {
        text = await extractImageOcr(file);
      }
    }
  } catch {
    // extraction failed — keep entry with empty text
  }
  return {
    size: file.size,
    lastModified: file.lastModified,
    text: text.slice(0, FILE_INDEX_MAX_TEXT),
    skipped,
    skipReason,
  };
}

async function collectFolderFiles(handle) {
  const files = [];
  for await (const entry of walkFolder(handle)) {
    const ext = fileExt(entry.name);
    if (!isSupportedFileExt(ext)) continue;
    files.push({ ...entry, ext });
    if (files.length >= FILE_INDEX_MAX_FILES) break;
  }
  return files;
}

export async function indexFolderFully(handle, onProgress) {
  const found = await collectFolderFiles(handle);
  const files = [];
  for (let i = 0; i < found.length; i++) {
    const f = found[i];
    onProgress?.({ current: i + 1, total: found.length, name: f.name });
    const info = await readFileText(f.handle, f.ext);
    files.push({
      id: `${f.path}#${info.lastModified}`,
      path: f.path,
      name: f.name,
      size: info.size,
      lastModified: info.lastModified,
      text: info.text,
      skipped: info.skipped,
      skipReason: info.skipReason,
    });
  }
  return files;
}

export async function syncFolderIncremental(handle, existingFiles, onProgress) {
  const found = await collectFolderFiles(handle);
  const existing = new Map(existingFiles.map((f) => [f.path, f]));
  const result = [];
  const stats = await Promise.all(
    found.map(async (f) => {
      const file = await f.handle.getFile();
      return { f, size: file.size, lastModified: file.lastModified };
    })
  );
  let total = 0;
  for (const s of stats) {
    const prev = existing.get(s.f.path);
    if (!prev || prev.lastModified !== s.lastModified) total += 1;
  }
  let processed = 0;
  for (const s of stats) {
    const prev = existing.get(s.f.path);
    if (prev && prev.lastModified === s.lastModified) {
      result.push(prev);
      continue;
    }
    processed += 1;
    onProgress?.({ current: processed, total, name: s.f.name });
    const info = await readFileText(s.f.handle, s.f.ext);
    result.push({
      id: `${s.f.path}#${info.lastModified}`,
      path: s.f.path,
      name: s.f.name,
      size: info.size,
      lastModified: info.lastModified,
      text: info.text,
      skipped: info.skipped,
      skipReason: info.skipReason,
    });
  }
  const changed = total > 0 || result.length !== existingFiles.length;
  return { files: result, changed };
}

export async function resolveFileFromHandle(folderHandle, path) {
  const parts = path.split("/");
  const filename = parts.pop();
  let dir = folderHandle;
  for (const seg of parts) {
    dir = await dir.getDirectoryHandle(seg);
  }
  const fileHandle = await dir.getFileHandle(filename);
  return fileHandle.getFile();
}

export function loadFileIndex() {
  try {
    const raw = localStorage.getItem(FILE_INDEX_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.folders)) return parsed;
    }
  } catch {
    // ignore
  }
  return { folders: [] };
}
