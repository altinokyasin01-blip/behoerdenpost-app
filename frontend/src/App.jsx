import { useEffect, useMemo, useRef, useState } from "react";
import API_BASE from "./config.js";
import {
  supabase,
  SUPABASE_CONFIGURED,
  fetchAll,
  syncDiff,
  bulkInsert,
} from "./supabase.js";
import "./App.css";

const TODAY = new Date("2026-07-02T00:00:00");
const STORAGE_KEY = "buero_docs";
const DISCLAIMER_KEY = "buero_disclaimer_shown";
const ONBOARDING_KEY = "buero_onboarding_done";
const EMAIL_KEY = "buero_user_email";
const CONTACTS_KEY = "buero_contacts";
const REMINDERS_KEY = "buero_reminders";
const EVENTS_KEY = "buero_events";

const LEGACY_KEY_MAP = {
  buero_docs: "behoerdenpost_docs",
  buero_contacts: "behoerdenpost_contacts",
  buero_reminders: "behoerdenpost_reminders",
  buero_events: "behoerdenpost_events",
  buero_disclaimer_shown: "disclaimer_shown",
  buero_onboarding_done: "onboarding_done",
  buero_user_email: "user_email",
};

(function migrateLegacyKeys() {
  if (typeof localStorage === "undefined") return;
  for (const [newKey, oldKey] of Object.entries(LEGACY_KEY_MAP)) {
    try {
      const existing = localStorage.getItem(newKey);
      const legacy = localStorage.getItem(oldKey);
      if (existing === null && legacy !== null) {
        localStorage.setItem(newKey, legacy);
      }
      if (legacy !== null) {
        localStorage.removeItem(oldKey);
      }
    } catch {
      // ignore per-key migration failures
    }
  }
})();
const THEME_KEY = "buero_theme";
const THEME_CHOICES = ["system", "light", "dark"];
const THEME_LABEL = { system: "System", light: "Hell", dark: "Dunkel" };
const FILE_INDEX_KEY = "buero_file_index";
const FILE_INDEX_MAX_FILES = 50;
const FILE_INDEX_MAX_TEXT = 5000;

const EXT_TEXT_PLAIN = new Set([".txt", ".md"]);
const EXT_PDF = new Set([".pdf"]);
const EXT_IMAGE = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const PDF_MAX_PAGES = 20;

const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const TESSERACT_URL = "https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.5/tesseract.min.js";
const JSQR_URL = "https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar";
const GIS_URL = "https://accounts.google.com/gsi/client";
const GOOGLE_TOKEN_KEY = "buero_google_token";
const GOOGLE_AUTO_EXPORT_KEY = "buero_google_auto_export";
const GOOGLE_SHOW_CALENDAR_KEY = "buero_google_show_calendar";
const GOOGLE_CONFIGURED = !!GOOGLE_CLIENT_ID;

function isSupportedFileExt(ext) {
  return EXT_TEXT_PLAIN.has(ext) || EXT_PDF.has(ext) || EXT_IMAGE.has(ext);
}

function loadScript(src) {
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
function getPdfJs() {
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
function getTesseract() {
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
function getJsQR() {
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

let gisPromise = null;
function getGoogleOAuth2() {
  if (!gisPromise) {
    gisPromise = (async () => {
      await loadScript(GIS_URL);
      const api = window.google?.accounts?.oauth2;
      if (!api) throw new Error("Google Identity Services not available");
      return api;
    })().catch((e) => {
      gisPromise = null;
      throw e;
    });
  }
  return gisPromise;
}

function googleSignIn() {
  if (!GOOGLE_CONFIGURED) {
    return Promise.reject(new Error("Google Client-ID nicht konfiguriert"));
  }
  return new Promise((resolve, reject) => {
    getGoogleOAuth2()
      .then((oauth2) => {
        const client = oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: GOOGLE_SCOPE,
          callback: (resp) => {
            if (resp.error) {
              reject(new Error(resp.error_description || resp.error));
              return;
            }
            const expiresIn = Number(resp.expires_in) || 3600;
            resolve({
              accessToken: resp.access_token,
              expiresAt: Date.now() + (expiresIn - 60) * 1000,
            });
          },
          error_callback: (err) =>
            reject(new Error(err.type || "authorization_failed")),
        });
        client.requestAccessToken({ prompt: "" });
      })
      .catch(reject);
  });
}

function googleRevoke(token) {
  if (!token) return Promise.resolve();
  return getGoogleOAuth2()
    .then((oauth2) => {
      return new Promise((resolve) => {
        oauth2.revoke(token, () => resolve());
      });
    })
    .catch(() => {});
}

async function googleCreateEvent(accessToken, googleEvent) {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(googleEvent),
    }
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error("token_expired");
    throw new Error(data.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

async function googleListEvents(accessToken, timeMin, timeMax) {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "150",
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    if (res.status === 401) throw new Error("token_expired");
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

function bueroItemToGoogleEvent(item, kind) {
  const label =
    kind === "deadline" ? "Frist" : kind === "reminder" ? "Erinnerung" : "Termin";
  const title = `${label}: ${item.title}`;
  const descriptionParts = [
    "Erstellt von Büro.",
    item.sender ? `Absender: ${item.sender}` : null,
    item.amount != null
      ? `Betrag: ${item.amount.toLocaleString("de-DE", {
          style: "currency",
          currency: "EUR",
        })}`
      : null,
    item.notes || item.summary || null,
  ].filter(Boolean);

  const base = {
    summary: title,
    description: descriptionParts.join("\n\n"),
    extendedProperties: {
      private: { source: "buero", kind },
    },
  };

  if (kind === "event" && item.time) {
    const [h, m] = item.time.split(":").map(Number);
    const startIso = `${item.date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
    const endH = (h + 1) % 24;
    const endIso = `${item.date}T${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
    return {
      ...base,
      start: {
        dateTime: startIso,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endIso,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };
  }

  const date =
    kind === "deadline" ? item.deadline : item.date;
  if (!date) return null;
  const next = new Date(date + "T00:00:00");
  next.setDate(next.getDate() + 1);
  return {
    ...base,
    start: { date },
    end: { date: isoLocal(next) },
  };
}

const ICS_KIND_LABEL = {
  deadline: "Frist",
  reminder: "Erinnerung",
  event: "Termin",
};

function icsEscape(s) {
  if (s == null) return "";
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function icsFoldLine(line) {
  if (line.length <= 74) return line;
  const parts = [];
  let i = 0;
  while (i < line.length) {
    const chunkLen = parts.length === 0 ? 74 : 73;
    parts.push(line.slice(i, i + chunkLen));
    i += chunkLen;
  }
  return parts.join("\r\n ");
}

function icsDate(iso) {
  return iso.replace(/-/g, "");
}

function icsDateTime(iso, time) {
  const [h, m] = time.split(":").map(Number);
  return `${icsDate(iso)}T${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
}

function icsAddDay(iso) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return isoLocal(d);
}

function icsAddHour(iso, time) {
  const [h, m] = time.split(":").map(Number);
  const endH = (h + 1) % 24;
  return `${icsDate(iso)}T${String(endH).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
}

function icsNowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function icsEventLines(entry) {
  const kindLabel = ICS_KIND_LABEL[entry.kind] || "Eintrag";
  const summary = `${kindLabel}: ${entry.title}`;
  const uid = `${entry.uid || entry.id}@meinbuero.app`;
  const description = [
    entry.notes,
    `Typ: ${kindLabel}`,
    "Erstellt von Büro",
  ]
    .filter(Boolean)
    .join("\n\n");

  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${icsNowStamp()}`,
  ];

  if (entry.kind === "event" && entry.time) {
    lines.push(`DTSTART:${icsDateTime(entry.date, entry.time)}`);
    lines.push(`DTEND:${icsAddHour(entry.date, entry.time)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${icsDate(entry.date)}`);
    lines.push(`DTEND;VALUE=DATE:${icsDate(icsAddDay(entry.date))}`);
  }

  lines.push(`SUMMARY:${icsEscape(summary)}`);
  if (description) lines.push(`DESCRIPTION:${icsEscape(description)}`);
  lines.push("URL:https://meinbuero.app");
  lines.push("END:VEVENT");

  return lines;
}

function generateICS(entries) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Büro//Büro App//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const e of entries) {
    lines.push(...icsEventLines(e));
  }
  lines.push("END:VCALENDAR");
  return lines.map(icsFoldLine).join("\r\n") + "\r\n";
}

function downloadICS(filename, entries) {
  const ics = generateICS(entries);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function docToIcsEntry(doc) {
  return {
    kind: "deadline",
    id: doc.id,
    title: doc.title,
    date: doc.deadline,
    notes: [
      doc.sender && `Absender: ${doc.sender}`,
      doc.amount != null &&
        `Betrag: ${doc.amount.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}`,
      doc.summary,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

function reminderToIcsEntry(reminder) {
  return {
    kind: "reminder",
    id: reminder.id,
    title: reminder.title,
    date: reminder.date,
    notes: reminder.notes,
  };
}

function eventToIcsEntry(event) {
  return {
    kind: "event",
    id: event.id,
    title: event.title,
    date: event.date,
    time: event.time,
    notes: event.notes,
  };
}

function loadGoogleToken() {
  try {
    const raw = localStorage.getItem(GOOGLE_TOKEN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.accessToken === "string" && parsed.expiresAt) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function loadBoolPref(key, defaultValue) {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return defaultValue;
    return v === "1";
  } catch {
    return defaultValue;
  }
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

const FS_SUPPORTED = typeof window !== "undefined" && "showDirectoryPicker" in window;

const IDB_NAME = "buero";
const IDB_STORE = "folder_handles";

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAll() {
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

async function idbPut(id, handle) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(handle, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(id) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function fileExt(name) {
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

async function indexFolderFully(handle, onProgress) {
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

async function syncFolderIncremental(handle, existingFiles, onProgress) {
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

async function resolveFileFromHandle(folderHandle, path) {
  const parts = path.split("/");
  const filename = parts.pop();
  let dir = folderHandle;
  for (const seg of parts) {
    dir = await dir.getDirectoryHandle(seg);
  }
  const fileHandle = await dir.getFileHandle(filename);
  return fileHandle.getFile();
}

function loadFileIndex() {
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

const CONTACT_TYPES = [
  "Behörde",
  "Bank",
  "Vermieter",
  "Arbeitgeber",
  "Universität",
  "Arzt",
  "Versicherung",
  "Sonstiges",
];

const CATEGORY_TO_CONTACT_TYPE = {
  Finanzamt: "Behörde",
  Krankenkasse: "Versicherung",
  Vermieter: "Vermieter",
  Inkasso: "Sonstiges",
  Versicherung: "Versicherung",
  Sonstiges: "Sonstiges",
};

const DOC_CATEGORIES = [
  "Finanzamt",
  "Krankenkasse",
  "Vermieter",
  "Inkasso",
  "Versicherung",
  "Sonstiges",
];

const DEADLINE_TYPES = ["zahlung", "antwort", "widerspruch", "abgabe", "sonstiges"];
const DEADLINE_TYPE_LABEL = {
  zahlung: "Zahlung",
  antwort: "Antwort",
  widerspruch: "Widerspruch",
  abgabe: "Abgabe",
  sonstiges: "Sonstiges",
};

const REMINDER_DAYS_BEFORE_OPTIONS = [0, 1, 3, 7];

function isoLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(iso, delta) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return isoLocal(d);
}

function todayIso() {
  return isoLocal(TODAY);
}

function formatAmount(v) {
  if (v == null || v === "") return "";
  if (typeof v === "string") return v;
  return v.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || "");
}

function sendDeadlineReminders(docs, reminders = []) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  const today = isoLocal(TODAY);
  for (const d of docs) {
    if (d.status === "Erledigt" || !d.deadline) continue;
    const days = daysUntil(d.deadline);
    if (days > 3) continue;
    const key = `notified_${d.id}_${today}`;
    try {
      if (localStorage.getItem(key)) continue;
      new Notification("Frist läuft ab", {
        body: `${d.title} — noch ${days} Tag${days === 1 ? "" : "e"}`,
      });
      localStorage.setItem(key, "1");
    } catch {
      // ignore per-doc failures
    }
  }
  for (const r of reminders) {
    if (r.done || !r.date) continue;
    const days = daysUntil(r.date);
    const daysBefore = r.daysBefore ?? 0;
    if (days > daysBefore) continue;
    const key = `notified_${r.id}_${today}`;
    try {
      if (localStorage.getItem(key)) continue;
      new Notification("Erinnerung", {
        body: `${r.title} — ${
          days > 0
            ? `in ${days} Tag${days === 1 ? "" : "en"}`
            : days === 0
            ? "heute"
            : "überfällig"
        }`,
      });
      localStorage.setItem(key, "1");
    } catch {
      // ignore per-reminder failures
    }
  }
}

const svgProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function IconHome({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconScan({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  );
}

function IconGrid({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function IconArchive({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

function IconCamera({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function IconUpload({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function IconSearch({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconChevron({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IconUser({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconContacts({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconCalendar({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconSettings({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconFile({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function IconQr({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <line x1="14" y1="14" x2="14" y2="21" />
      <line x1="18" y1="14" x2="18" y2="17" />
      <line x1="14" y1="18" x2="17" y2="18" />
      <line x1="18" y1="21" x2="21" y2="21" />
      <line x1="21" y1="18" x2="21" y2="14" />
    </svg>
  );
}

function IconTemplate({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <line x1="8" y1="8" x2="16" y2="8" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="12" y2="16" />
    </svg>
  );
}

function IconSun({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="1" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
      <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
      <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
    </svg>
  );
}

function IconMoon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function IconMonitor({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...svgProps}>
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

const THEME_ICON = {
  system: IconMonitor,
  light: IconSun,
  dark: IconMoon,
};

const CATEGORY_SYMBOLS = {
  Finanzamt: "§",
  Krankenkasse: "+",
  Vermieter: "⌂",
  Inkasso: "!",
  Versicherung: "◆",
  Sonstiges: "…",
};

function categorySymbol(name) {
  return CATEGORY_SYMBOLS[name] || name.charAt(0).toUpperCase();
}

const NAV_ITEMS = [
  { id: "home", label: "Home", Icon: IconHome },
  { id: "calendar", label: "Kalender", Icon: IconCalendar },
  { id: "scan", label: "Scan", Icon: IconScan },
  { id: "templates", label: "Vorlagen", Icon: IconTemplate },
  { id: "categories", label: "Kategorien", Icon: IconGrid },
  { id: "contacts", label: "Kontakte", Icon: IconContacts },
  { id: "archive", label: "Archiv", Icon: IconArchive },
  { id: "settings", label: "Einstellungen", Icon: IconSettings },
];

const TEMPLATE_TYPES = [
  { id: "kuendigung", label: "Kündigung", desc: "Vertrag oder Abo kündigen" },
  { id: "widerspruch", label: "Widerspruch", desc: "Bescheid oder Entscheidung widersprechen" },
  { id: "zahlungserinnerung", label: "Zahlungserinnerung", desc: "Ausstehende Rechnung anmahnen" },
  { id: "nachfrage", label: "Nachfrage", desc: "Rückfrage zu einem Vorgang" },
  { id: "akteneinsicht", label: "Akteneinsicht", desc: "Zugang zu deiner Akte fordern" },
  { id: "beschwerde", label: "Beschwerde", desc: "Formelle Beschwerde einreichen" },
  { id: "vollmacht", label: "Vollmacht", desc: "Jemanden bevollmächtigen" },
  { id: "datenschutzauskunft", label: "Datenschutzauskunft", desc: "Auskunft nach DSGVO Art. 15" },
];

const USER_NAME_KEY = "buero_user_name";
const TIPS_SEEN_KEY = "buero_tips_seen";
const INSTALL_DISMISSED_KEY = "buero_install_dismissed";
const BROWSER_TIP_SEEN_KEY = "buero_browser_tip_seen";

const BROWSER_TIP_TEXT =
  "Einige Funktionen wie der lokale Datei-Zugriff sind nur in Chrome und Edge verfügbar. Alle anderen Funktionen laufen in jedem Browser.";

(function migrateTipsSeen() {
  if (typeof localStorage === "undefined") return;
  try {
    if (localStorage.getItem(TIPS_SEEN_KEY) !== null) return;
    const oldRaw = localStorage.getItem("buero_tooltips_seen");
    if (!oldRaw) return;
    const parsed = JSON.parse(oldRaw);
    if (!Array.isArray(parsed)) return;
    const migrated = parsed.map((id) =>
      typeof id === "string" && id.startsWith("tab_") ? id.slice(4) : id
    );
    localStorage.setItem(TIPS_SEEN_KEY, JSON.stringify(migrated));
    localStorage.removeItem("buero_tooltips_seen");
  } catch {
    // ignore
  }
})();

const APP_VERSION = "0.1.0";
const SUPPORT_EMAIL = "support@buero.app";

const LEGAL_TEXTS = {
  impressum: {
    title: "Impressum",
    body: (
      <>
        <p>
          <strong>Angaben gemäß § 5 TMG</strong>
        </p>
        <p>
          Yasin Altinok
          <br />
          [DEINE ADRESSE]
          <br />
          Deutschland
        </p>
        <p>
          <strong>Kontakt</strong>
          <br />
          E-Mail: kontakt@meinbuero.app
        </p>
        <p>
          <strong>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</strong>
          <br />
          Yasin Altinok
        </p>
        <p className="detail-muted">
          Ersetze die Platzhalter in eckigen Klammern durch deine echten
          Angaben, bevor Büro öffentlich verfügbar wird.
        </p>
      </>
    ),
  },
  datenschutz: {
    title: "Datenschutzerklärung",
    body: (
      <>
        <p>
          Deine Privatsphäre ist der Kern der App. Büro ist bewusst als lokale
          Web-App gebaut — deine Daten liegen bei dir, nicht bei uns.
        </p>
        <p>
          <strong>Was auf deinem Gerät gespeichert wird</strong>
          <br />
          Dokumente, Kontakte, Erinnerungen, Termine, App-Einstellungen und
          (wenn du Ordner freigibst) der extrahierte Text lokaler Dateien.
          Alles landet ausschließlich in localStorage und IndexedDB deines
          Browsers — nicht bei uns, nicht auf fremden Servern.
        </p>
        <p>
          <strong>Was temporär an externe Dienste geht</strong>
          <br />
          Für die KI-Analyse werden Dokumente und Textinhalte kurzzeitig an
          die Anthropic Claude API übertragen: beim Scannen das Bild/PDF, bei
          Vorlagen/Widerspruch-Check/QR-Analyse der jeweilige Textinhalt.
          Diese Übertragung ist für die Analyse notwendig; die Daten werden
          von Anthropic gemäß deren Datenschutzerklärung
          (anthropic.com/privacy) behandelt und laut Anbieter{" "}
          <strong>nicht dauerhaft zu Trainingszwecken gespeichert</strong>.
          Bei aktivierter Google-Calendar-Verknüpfung fließen die von dir
          erstellten Fristen/Termine direkt aus deinem Browser zur Google
          Calendar API — kein Backend-Umweg über uns.
        </p>
        <p>
          <strong>Was NICHT passiert</strong>
          <br />
          Kein Tracking, keine Analytics, keine Cookies. Keine Weitergabe an
          Dritte über die genannten APIs hinaus. Kein eigener Server, der
          deine Daten dauerhaft speichert.
        </p>
        <p>
          <strong>Deine Rechte nach DSGVO</strong>
          <br />
          Auskunft: „Daten exportieren" liefert eine vollständige JSON-Kopie.
          Löschung: „Alle Daten löschen" wischt alles vom Gerät. Widerruf:
          einfach nicht mehr benutzen.
        </p>
        <p>
          <strong>Verantwortlich</strong>
          <br />
          Siehe Impressum.
        </p>
      </>
    ),
  },
  agb: {
    title: "Nutzungsbedingungen",
    body: (
      <>
        <p>
          <strong>1. Was Büro ist</strong>
          <br />
          Büro ist ein persönlicher Assistent für die Verwaltung von Post,
          Fristen, Kontakten und Terminen. Die App analysiert deine Dokumente
          mit KI (Anthropic Claude) und schlägt Aktionen vor.
        </p>
        <p>
          <strong>2. Was Büro NICHT ist</strong>
          <br />
          Büro ersetzt keine juristische, steuerliche oder finanzielle
          Beratung. Alle Analysen und Vorschläge sind unverbindliche
          Hinweise — keine Rechts- oder Steuerauskunft.
        </p>
        <p>
          <strong>3. Haftung für KI-generierte Inhalte</strong>
          <br />
          Alle Analysen, Zusammenfassungen, Vorlagen-Anschreiben,
          Widerspruch-Einschätzungen und Aktions-Vorschläge werden durch ein
          KI-Sprachmodell erzeugt. KI-Systeme können falsche Angaben liefern,
          Fristen falsch lesen, Beträge verwechseln oder rechtliche
          Einschätzungen abgeben, die im konkreten Fall unzutreffend sind.
          Wir übernehmen <strong>keinerlei Gewähr</strong> für die
          Richtigkeit, Vollständigkeit oder rechtliche Verbindlichkeit dieser
          Ausgaben. Prüfe jede automatisch erzeugte Information selbst bevor
          du danach handelst.
        </p>
        <p>
          <strong>4. Deine Verantwortung</strong>
          <br />
          Für Entscheidungen auf Basis der App-Ausgaben bist du selbst
          verantwortlich. Bei rechtlich oder finanziell bedeutenden
          Angelegenheiten konsultiere einen Anwalt, Steuerberater oder
          anderen Fachmann.
        </p>
        <p>
          <strong>5. Externe Dienste</strong>
          <br />
          Büro nutzt aktuell die Anthropic Claude API (für KI-Analysen) und
          optional die Google Calendar API (für Kalender-Synchronisation).
          Weitere Verknüpfungen — z.B. Apple Kalender, Outlook oder andere
          Cloud-Dienste — können in zukünftigen Versionen ergänzt werden.
          Ihre Nutzung ist jeweils optional und wird an der betreffenden
          Stelle in der App explizit als solche gekennzeichnet.
        </p>
        <p>
          <strong>6. Datenschutz</strong>
          <br />
          Siehe Datenschutzerklärung.
        </p>
        <p>
          <strong>7. Änderungen</strong>
          <br />
          Diese Bedingungen können sich ändern. Aktuelle Fassung immer in der
          App einsehbar.
        </p>
        <p className="detail-muted">Stand: Version {APP_VERSION}</p>
      </>
    ),
  },
};

const TAB_TIPS = {
  home: "Deine Kommandozentrale — Fristen, Ausgaben und Erinnerungen auf einen Blick.",
  calendar:
    "Verbinde Google Calendar in den Einstellungen, um deine Termine automatisch zu synchronisieren.",
  scan: "Lade einen Brief oder eine Rechnung hoch — Büro erkennt automatisch Fristen und schlägt Aktionen vor.",
  templates:
    "Häufige Anschreiben in Sekunden — Kündigung, Widerspruch, Datenschutzauskunft und mehr.",
  categories: "Deine Post nach Absender-Typ gruppiert. Klick öffnet das gefilterte Archiv.",
  contacts:
    "Speichere Behörden, Banken und Vermieter mit IBAN und Adresse — verknüpft automatisch mit deinen Dokumenten.",
  archive: "Alle Dokumente durchsuchen und filtern. Auch erledigte bleiben hier auffindbar.",
  settings:
    "Verbinde Google Calendar, gib Ordner frei und passe Büro an deine Bedürfnisse an.",
};

const SEARCH_TIP =
  "Suche nach IBANs, Beträgen, Namen oder Daten — alles was in Büro gespeichert ist.";

const INITIAL_DOCS = [];

function daysUntil(iso) {
  const d = new Date(iso + "T00:00:00");
  return Math.ceil((d - TODAY) / 86400000);
}

function deadlineLevel(days) {
  if (days < 7) return "red";
  if (days < 14) return "amber";
  return "green";
}

function progressPct(days) {
  const pct = ((30 - days) / 30) * 100;
  return Math.max(4, Math.min(100, pct));
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("de-DE");
}

function StatusBadge({ status }) {
  const map = { Offen: "red", Pending: "amber", Erledigt: "green" };
  return (
    <span className={`badge badge-${map[status] || "gray"}`}>{status}</span>
  );
}

function Modal({ onClose, children, dismissable = true }) {
  useEffect(() => {
    if (!dismissable) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, dismissable]);

  return (
    <div
      className="modal-overlay"
      onClick={dismissable ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        {dismissable && (
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Schließen"
          >
            ×
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

function CategoryEditor({
  value,
  existingCategories = [],
  onChange,
  onCancel,
}) {
  const [draft, setDraft] = useState(value || "");
  const inputRef = useRef(null);
  const listId = useMemo(
    () => "catlist-" + Math.random().toString(36).slice(2, 8),
    []
  );

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function commit() {
    const v = draft.trim();
    if (v && v !== value) {
      onChange(v);
    } else {
      onCancel?.();
    }
  }

  return (
    <div className="category-editor">
      <input
        ref={inputRef}
        type="text"
        list={listId}
        className="form-input category-editor-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel?.();
          }
        }}
        placeholder="Kategorie eingeben oder wählen"
        autoComplete="off"
      />
      <datalist id={listId}>
        {existingCategories.map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>
      <button
        type="button"
        className="btn-primary btn-primary-sm"
        onClick={commit}
      >
        Übernehmen
      </button>
      <button
        type="button"
        className="btn-secondary btn-primary-sm"
        onClick={() => onCancel?.()}
      >
        Abbrechen
      </button>
    </div>
  );
}

function CategoryChip({ value, existingCategories, onChange }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <CategoryEditor
        value={value}
        existingCategories={existingCategories}
        onChange={(v) => {
          onChange(v);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }
  return (
    <button
      type="button"
      className="badge badge-neutral badge-editable"
      onClick={() => setEditing(true)}
      title="Kategorie bearbeiten"
    >
      {value || "Kategorie hinzufügen"}
      <span className="badge-edit-hint" aria-hidden="true">
        ✎
      </span>
    </button>
  );
}

function DocumentModal({
  doc,
  onClose,
  onToggleStatus,
  onEditDeadline,
  onDelete,
  onExportToCalendar,
  existingCategories,
  onUpdateCategory,
}) {
  const [copied, setCopied] = useState(false);
  const days = doc.deadline ? daysUntil(doc.deadline) : null;
  const level = days !== null ? deadlineLevel(days) : null;

  async function handleCopy() {
    if (!doc.replyDraft) return;
    try {
      await navigator.clipboard.writeText(doc.replyDraft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard permission denied — ignore
    }
  }

  const isDone = doc.status === "Erledigt";

  return (
    <Modal onClose={onClose}>
      <div className="detail">
        <div className="detail-head">
          <div className="detail-title">{doc.title}</div>
          <div className="detail-badges">
            <CategoryChip
              value={doc.category}
              existingCategories={existingCategories}
              onChange={(cat) => onUpdateCategory(doc.id, cat)}
            />
            <StatusBadge status={doc.status} />
          </div>
          <div className="detail-sender">
            {doc.sender} · {formatDate(doc.date)}
          </div>
        </div>

        {doc.deadline && (
          <div className={`detail-deadline detail-deadline-${level}`}>
            <div className="detail-deadline-label">
              Frist
              <DeadlineTypeBadge type={doc.deadlineType} />
            </div>
            <div className="detail-deadline-date">
              {formatDate(doc.deadline)}
            </div>
            <div className={`detail-deadline-days days-${level}`}>
              {days > 0
                ? `noch ${days} Tag${days === 1 ? "" : "e"}`
                : days === 0
                ? "heute fällig"
                : `${Math.abs(days)} Tag${Math.abs(days) === 1 ? "" : "e"} überfällig`}
            </div>
          </div>
        )}

        {doc.summary && (
          <section className="detail-section">
            <h3 className="detail-heading">Zusammenfassung</h3>
            <p className="detail-text">{doc.summary}</p>
          </section>
        )}

        {doc.replyDraft && (
          <section className="detail-section">
            <div className="detail-heading-row">
              <h3 className="detail-heading">Antwortentwurf</h3>
              <button type="button" className="copy-btn" onClick={handleCopy}>
                {copied ? "Kopiert" : "Kopieren"}
              </button>
            </div>
            <pre className="code-block">{doc.replyDraft}</pre>
            <div className="reply-actions">
              <a
                className="btn-secondary"
                href={`mailto:?subject=${encodeURIComponent(
                  "Re: " + doc.title
                )}&body=${encodeURIComponent(doc.replyDraft)}`}
              >
                Antwort per E-Mail senden
              </a>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => window.print()}
              >
                Als PDF speichern
              </button>
            </div>
          </section>
        )}

        {doc.replyDraft && (
          <div className="print-area" aria-hidden="true">
            <h1>{doc.title}</h1>
            <div className="print-meta">
              {doc.sender} · {formatDate(doc.date)}
            </div>
            <h2>Antwortentwurf</h2>
            <pre>{doc.replyDraft}</pre>
          </div>
        )}

        <div className="detail-actions detail-actions-stack">
          <button
            type="button"
            className={`btn-status ${isDone ? "btn-status-reopen" : "btn-status-done"}`}
            onClick={onToggleStatus}
          >
            {isDone ? "Als offen markieren" : "Als erledigt markieren"}
          </button>
          {doc.deadline && (
            <button
              type="button"
              className="btn-secondary btn-primary-block"
              onClick={onExportToCalendar}
            >
              Zu Kalender hinzufügen
            </button>
          )}
          <div className="detail-actions-row">
            <button
              type="button"
              className="btn-secondary"
              onClick={onEditDeadline}
            >
              {doc.deadline ? "Frist bearbeiten" : "Frist hinzufügen"}
            </button>
            <button
              type="button"
              className="btn-secondary btn-danger"
              onClick={onDelete}
            >
              Löschen
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

const ACTION_TYPE_LABEL = {
  contact: "Kontakt",
  reminder: "Erinnerung",
  amount: "Betrag",
  deadline: "Frist",
  note: "Notiz",
  event: "Termin",
};

function formatActionValue(action) {
  if (action.value == null || action.value === "") return "";
  if (action.type === "amount") {
    const n = typeof action.value === "number" ? action.value : Number(action.value);
    return Number.isFinite(n) ? formatAmount(n) : String(action.value);
  }
  if (action.type === "deadline" || action.type === "reminder") {
    return formatDate(action.value);
  }
  if (action.type === "event") {
    const v = action.value || {};
    const parts = [];
    if (v.date) parts.push(formatDate(v.date));
    if (v.time) parts.push(v.time);
    if (v.notes) parts.push(v.notes);
    return parts.join(" · ");
  }
  if (action.type === "contact") {
    // value can be either a plain string (legacy) or a rich object
    if (typeof action.value === "string") return action.value;
    const v = action.value || {};
    const parts = [v.name];
    if (v.type) parts.push(v.type);
    const loc = [v.zip, v.city].filter(Boolean).join(" ");
    if (loc) parts.push(loc);
    if (v.email) parts.push(v.email);
    return parts.filter(Boolean).join(" · ");
  }
  return String(action.value);
}

function PostScanModal({
  result,
  isFirstScan,
  existingCategories,
  onConfirm,
  onSkip,
}) {
  const actions = Array.isArray(result.actions) ? result.actions : [];

  const [enabled, setEnabled] = useState(() => {
    const map = {};
    actions.forEach((a, i) => {
      map[i] = a.priority !== "low";
    });
    return map;
  });
  const [categoryDraft, setCategoryDraft] = useState(
    result.category || "Sonstiges"
  );

  function toggle(i) {
    setEnabled((prev) => ({ ...prev, [i]: !prev[i] }));
  }

  function handleConfirm() {
    onConfirm(
      actions.filter((_, i) => enabled[i]),
      { category: categoryDraft }
    );
  }

  return (
    <Modal onClose={onSkip}>
      <div className="detail">
        <div className="detail-head">
          <div className="detail-title">
            Erkannt: {result.documentType || "Dokument"}
          </div>
          <div className="detail-badges">
            <CategoryChip
              value={categoryDraft}
              existingCategories={existingCategories}
              onChange={setCategoryDraft}
            />
            {result.sender && (
              <span className="detail-sender">{result.sender}</span>
            )}
          </div>
          {result.summary && (
            <div className="postscan-summary">{result.summary}</div>
          )}
        </div>

        {isFirstScan && (
          <div className="tutorial-inline">
            <strong>Fast fertig!</strong> Claude hat dein Dokument gelesen und
            schlägt konkrete Actions vor. Wähle unten aus, was für dich Sinn
            ergibt — der Rest wird ignoriert.
          </div>
        )}

        <h3 className="detail-heading">Vorgeschlagene Aktionen</h3>
        <div className="action-list">
          {actions.length === 0 && (
            <div className="empty">
              Keine zusätzlichen Aktionen vorgeschlagen — Dokument wird gespeichert.
            </div>
          )}
          {actions.map((a, i) => {
            const displayValue = formatActionValue(a);
            const isOn = !!enabled[i];
            return (
              <label
                key={i}
                className={`action-item priority-${a.priority} ${isOn ? "on" : ""}`}
              >
                <input
                  type="checkbox"
                  className="action-check"
                  checked={isOn}
                  onChange={() => toggle(i)}
                />
                <div className="action-body">
                  <div className="action-row">
                    {a.type === "event" && (
                      <span className="action-icon-lead">
                        <IconCalendar size={14} />
                      </span>
                    )}
                    <span className={`action-tag tag-${a.type}`}>
                      {ACTION_TYPE_LABEL[a.type] || a.type}
                    </span>
                    <span className={`priority-dot priority-${a.priority}`} />
                  </div>
                  <div className="action-title">{a.label}</div>
                  {displayValue && (
                    <div className="action-desc">{displayValue}</div>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        <div className="detail-actions detail-actions-row">
          <button type="button" className="btn-secondary" onClick={onSkip}>
            Überspringen
          </button>
          <button
            type="button"
            className="btn-primary btn-primary-block"
            onClick={handleConfirm}
          >
            Übernehmen
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DeadlineTypeBadge({ type }) {
  if (!type) return null;
  return (
    <span className={`deadline-type-badge deadline-type-${type}`}>
      {DEADLINE_TYPE_LABEL[type] || type}
    </span>
  );
}

function CardMenu({ items, ariaLabel = "Menü" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="card-menu" ref={ref}>
      <button
        type="button"
        className="card-menu-btn"
        aria-label={ariaLabel}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        ⋯
      </button>
      {open && (
        <div className="card-menu-popup">
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              className="card-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                it.onClick();
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GoogleSyncToggle({ checked, onChange }) {
  return (
    <label className="google-sync-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="google-sync-body">
        <div className="google-sync-title">Auch zu Google Calendar hinzufügen</div>
        <div className="google-sync-sub">Der Eintrag erscheint im verknüpften Google-Kalender.</div>
      </div>
    </label>
  );
}

function DeadlineEditModal({ doc, onSave, onCancel }) {
  const [date, setDate] = useState(doc.deadline || "");
  const [type, setType] = useState(doc.deadlineType || "sonstiges");

  function submit(e) {
    e.preventDefault();
    onSave({
      deadline: date || null,
      deadlineType: date ? type : null,
    });
  }

  return (
    <Modal onClose={onCancel}>
      <form onSubmit={submit} className="detail">
        <div className="detail-head">
          <div className="detail-title">
            {doc.deadline ? "Frist bearbeiten" : "Frist hinzufügen"}
          </div>
        </div>

        <div className="form-field">
          <label>Datum</label>
          <input
            type="date"
            className="form-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            autoFocus
          />
        </div>

        <div className="form-field">
          <label>Typ</label>
          <select
            className="form-input"
            value={type}
            onChange={(e) => setType(e.target.value)}
            disabled={!date}
          >
            {DEADLINE_TYPES.map((t) => (
              <option key={t} value={t}>
                {DEADLINE_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Abbrechen
          </button>
          <button type="submit" className="btn-primary btn-primary-block">
            Speichern
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ManualDeadlineFormModal({
  googleConnected,
  googleAutoExport,
  onSave,
  onCancel,
}) {
  const [form, setForm] = useState({
    title: "",
    sender: "",
    deadline: "",
    deadlineType: "sonstiges",
    amount: "",
    category: "Sonstiges",
    notes: "",
  });
  const [syncToGoogle, setSyncToGoogle] = useState(
    googleConnected && googleAutoExport
  );
  const [error, setError] = useState(null);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
  }

  function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Titel ist ein Pflichtfeld.");
      return;
    }
    if (!form.deadline) {
      setError("Frist-Datum ist ein Pflichtfeld.");
      return;
    }
    const raw = form.amount.trim().replace(/[€\s]/g, "").replace(",", ".");
    const amount = raw ? Number(raw) : null;
    if (raw && !Number.isFinite(amount)) {
      setError("Betrag ist keine gültige Zahl.");
      return;
    }
    onSave({
      title: form.title.trim(),
      sender: form.sender.trim(),
      deadline: form.deadline,
      deadlineType: form.deadlineType,
      amount: amount,
      category: form.category,
      notes: form.notes.trim(),
      syncToGoogle: googleConnected && syncToGoogle,
    });
  }

  return (
    <Modal onClose={onCancel}>
      <form onSubmit={submit} className="detail">
        <div className="detail-head">
          <div className="detail-title">Frist hinzufügen</div>
        </div>

        <div className="form-field">
          <label>Titel *</label>
          <input
            type="text"
            className="form-input"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="z.B. Steuererklärung 2025"
            autoFocus
          />
        </div>

        <div className="form-field">
          <label>Absender / Für wen</label>
          <input
            type="text"
            className="form-input"
            value={form.sender}
            onChange={(e) => set("sender", e.target.value)}
            placeholder="z.B. Finanzamt München"
          />
        </div>

        <div className="form-grid">
          <div className="form-field">
            <label>Frist *</label>
            <input
              type="date"
              className="form-input"
              value={form.deadline}
              onChange={(e) => set("deadline", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Typ</label>
            <select
              className="form-input"
              value={form.deadlineType}
              onChange={(e) => set("deadlineType", e.target.value)}
            >
              {DEADLINE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DEADLINE_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-grid">
          <div className="form-field">
            <label>Betrag (EUR)</label>
            <input
              type="text"
              inputMode="decimal"
              className="form-input"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              placeholder="z.B. 230,50"
            />
          </div>
          <div className="form-field">
            <label>Kategorie</label>
            <select
              className="form-input"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {DOC_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-field">
          <label>Notizen</label>
          <textarea
            className="form-input form-textarea"
            rows={3}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>

        {googleConnected && (
          <GoogleSyncToggle
            checked={syncToGoogle}
            onChange={setSyncToGoogle}
          />
        )}

        {error && <div className="onboarding-error">{error}</div>}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Abbrechen
          </button>
          <button type="submit" className="btn-primary btn-primary-block">
            Speichern
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ReminderFormModal({
  initial,
  docs,
  googleConnected,
  googleAutoExport,
  onSave,
  onCancel,
}) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(() => ({
    title: "",
    date: "",
    docId: null,
    daysBefore: 3,
    notes: "",
    ...(initial || {}),
  }));
  const [syncToGoogle, setSyncToGoogle] = useState(
    !isEdit && googleConnected && googleAutoExport
  );
  const [error, setError] = useState(null);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
  }

  function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Titel ist ein Pflichtfeld.");
      return;
    }
    if (!form.date) {
      setError("Datum ist ein Pflichtfeld.");
      return;
    }
    onSave({
      ...form,
      title: form.title.trim(),
      notes: form.notes ? form.notes.trim() : "",
      syncToGoogle: googleConnected && syncToGoogle,
    });
  }

  return (
    <Modal onClose={onCancel}>
      <form onSubmit={submit} className="detail">
        <div className="detail-head">
          <div className="detail-title">
            {initial ? "Erinnerung bearbeiten" : "Erinnerung hinzufügen"}
          </div>
        </div>

        <div className="form-field">
          <label>Titel *</label>
          <input
            type="text"
            className="form-input"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            autoFocus
          />
        </div>

        <div className="form-field">
          <label>Datum *</label>
          <input
            type="date"
            className="form-input"
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
          />
        </div>

        <div className="form-field">
          <label>Verknüpftes Dokument</label>
          <select
            className="form-input"
            value={form.docId || ""}
            onChange={(e) => set("docId", e.target.value || null)}
          >
            <option value="">— Kein Dokument —</option>
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>Erinnerung vorher</label>
          <div className="filter-pills">
            {REMINDER_DAYS_BEFORE_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                className={`pill ${form.daysBefore === n ? "active" : ""}`}
                onClick={() => set("daysBefore", n)}
              >
                {n === 0 ? "am Tag" : `${n} Tag${n === 1 ? "" : "e"} vorher`}
              </button>
            ))}
          </div>
        </div>

        <div className="form-field">
          <label>Notiz</label>
          <textarea
            className="form-input form-textarea"
            rows={3}
            value={form.notes || ""}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>

        {googleConnected && !isEdit && (
          <GoogleSyncToggle
            checked={syncToGoogle}
            onChange={setSyncToGoogle}
          />
        )}

        {error && <div className="onboarding-error">{error}</div>}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Abbrechen
          </button>
          <button type="submit" className="btn-primary btn-primary-block">
            Speichern
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ReminderDetailModal({
  reminder,
  doc,
  onEdit,
  onDelete,
  onToggleDone,
  onOpenDoc,
  onExportToCalendar,
  onClose,
}) {
  const days = daysUntil(reminder.date);
  const level = reminder.done ? "gray" : deadlineLevel(days);
  const daysBefore = reminder.daysBefore ?? 0;

  return (
    <Modal onClose={onClose}>
      <div className="detail">
        <div className="detail-head">
          <div className="detail-title">{reminder.title}</div>
          <div className="detail-badges">
            <span className={`badge badge-${reminder.done ? "green" : "gray"}`}>
              {reminder.done ? "Erledigt" : "Offen"}
            </span>
          </div>
        </div>

        <div className={`detail-deadline detail-deadline-${level}`}>
          <div className="detail-deadline-label">Termin</div>
          <div className="detail-deadline-date">{formatDate(reminder.date)}</div>
          <div className={`detail-deadline-days days-${level}`}>
            {reminder.done
              ? "erledigt"
              : days > 0
              ? `in ${days} Tag${days === 1 ? "" : "en"}`
              : days === 0
              ? "heute"
              : `${Math.abs(days)} Tag${Math.abs(days) === 1 ? "" : "e"} überfällig`}
          </div>
        </div>

        <section className="detail-section">
          <h3 className="detail-heading">Erinnerung</h3>
          <p className="detail-text">
            {daysBefore === 0
              ? "Benachrichtigung am Terminstag."
              : `Benachrichtigung ${daysBefore} Tag${daysBefore === 1 ? "" : "e"} vorher.`}
          </p>
        </section>

        {reminder.notes && (
          <section className="detail-section">
            <h3 className="detail-heading">Notiz</h3>
            <p className="detail-text">{reminder.notes}</p>
          </section>
        )}

        <section className="detail-section">
          <h3 className="detail-heading">Verknüpftes Dokument</h3>
          {doc ? (
            <button
              type="button"
              className="linked-item linked-clickable"
              onClick={() => onOpenDoc(doc.id)}
            >
              <div className="linked-title">{doc.title}</div>
              <div className="linked-meta">
                {doc.sender} · {formatDate(doc.date)}
              </div>
            </button>
          ) : reminder.orphaned ? (
            <p className="detail-text detail-muted">
              Dokument wurde gelöscht.
            </p>
          ) : (
            <p className="detail-text detail-muted">
              Nicht verknüpft.
            </p>
          )}
        </section>

        <button
          type="button"
          className="btn-secondary btn-primary-block"
          onClick={onExportToCalendar}
        >
          Zu Kalender hinzufügen
        </button>

        <div className="detail-actions detail-actions-row">
          <button type="button" className="btn-secondary" onClick={onDelete}>
            Löschen
          </button>
          <button type="button" className="btn-secondary" onClick={onToggleDone}>
            {reminder.done ? "Als offen markieren" : "Erledigt markieren"}
          </button>
          <button type="button" className="btn-primary" onClick={onEdit}>
            Bearbeiten
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AppealModal({
  doc,
  apiBase,
  onClose,
  onScheduleReminder,
  onShowReplyDraft,
}) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch(`${apiBase}/api/appeal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentType: doc.title,
            summary: doc.summary,
            deadlineType: doc.deadlineType,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) setAnalysis(data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const days = doc.deadline ? daysUntil(doc.deadline) : null;
  const worthwhile = analysis ? analysis.worthwhile !== false : true;

  return (
    <Modal onClose={onClose}>
      <div className="detail">
        <div className="detail-head">
          <div className="detail-title">Möchtest du Widerspruch einlegen?</div>
          {doc.deadline && (
            <div className="detail-sender">
              Frist {formatDate(doc.deadline)}
              {days != null && (
                <>
                  {" · "}
                  {days > 0
                    ? `noch ${days} Tag${days === 1 ? "" : "e"}`
                    : days === 0
                    ? "heute fällig"
                    : "überfällig"}
                </>
              )}
            </div>
          )}
        </div>

        {loading && (
          <div className="appeal-loading">
            <div className="loading-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div>Claude prüft die Erfolgsaussicht…</div>
          </div>
        )}

        {error && (
          <div className="alert">
            Einschätzung konnte nicht geladen werden ({error}).
          </div>
        )}

        {analysis && (
          <section className="detail-section appeal-analysis">
            <p className="detail-text">{analysis.reasoning}</p>
            <div className="appeal-chance-row">
              <span className="appeal-chance-label">Erfolgsaussicht</span>
              <span className={`appeal-badge appeal-badge-${analysis.successChance}`}>
                {analysis.successChance}
              </span>
            </div>
            {analysis.tip && (
              <div className="appeal-tip">{analysis.tip}</div>
            )}
          </section>
        )}

        <div className="appeal-actions">
          {!loading && !error && !worthwhile && (
            <div className="appeal-warning">Trotzdem widersprechen?</div>
          )}
          <button
            type="button"
            className={`btn-secondary ${!loading && !worthwhile ? "btn-dimmed" : ""}`}
            onClick={onScheduleReminder}
            disabled={loading}
          >
            Ja, erinnere mich früher
          </button>
          <button
            type="button"
            className={`btn-secondary ${!loading && !worthwhile ? "btn-dimmed" : ""}`}
            onClick={onShowReplyDraft}
            disabled={loading || !doc.replyDraft}
          >
            Antwortentwurf anzeigen
          </button>
        </div>

        <div className="appeal-decision">Die Entscheidung liegt bei dir.</div>
        <div className="appeal-disclaimer">
          Einschätzung basiert auf KI, kein Rechtsrat.
        </div>
      </div>
    </Modal>
  );
}

function EventFormModal({
  initial,
  contacts,
  googleConnected,
  googleAutoExport,
  onSave,
  onCancel,
}) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(() => ({
    title: "",
    date: "",
    time: "",
    contactId: null,
    notes: "",
    ...(initial || {}),
  }));
  const [syncToGoogle, setSyncToGoogle] = useState(
    !isEdit && googleConnected && googleAutoExport
  );
  const [error, setError] = useState(null);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
  }

  function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Titel ist ein Pflichtfeld.");
      return;
    }
    if (!form.date) {
      setError("Datum ist ein Pflichtfeld.");
      return;
    }
    onSave({
      ...form,
      title: form.title.trim(),
      time: form.time || "",
      notes: form.notes ? form.notes.trim() : "",
      syncToGoogle: googleConnected && syncToGoogle,
    });
  }

  return (
    <Modal onClose={onCancel}>
      <form onSubmit={submit} className="detail">
        <div className="detail-head">
          <div className="detail-title">
            {initial ? "Termin bearbeiten" : "Termin hinzufügen"}
          </div>
        </div>

        <div className="form-field">
          <label>Titel *</label>
          <input
            type="text"
            className="form-input"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            autoFocus
          />
        </div>

        <div className="form-grid">
          <div className="form-field">
            <label>Datum *</label>
            <input
              type="date"
              className="form-input"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Uhrzeit</label>
            <input
              type="time"
              className="form-input"
              value={form.time || ""}
              onChange={(e) => set("time", e.target.value)}
            />
          </div>
        </div>

        <div className="form-field">
          <label>Verknüpfter Kontakt</label>
          <select
            className="form-input"
            value={form.contactId || ""}
            onChange={(e) => set("contactId", e.target.value || null)}
          >
            <option value="">— Kein Kontakt —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>Notizen</label>
          <textarea
            className="form-input form-textarea"
            rows={3}
            value={form.notes || ""}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>

        {googleConnected && !isEdit && (
          <GoogleSyncToggle
            checked={syncToGoogle}
            onChange={setSyncToGoogle}
          />
        )}

        {error && <div className="onboarding-error">{error}</div>}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Abbrechen
          </button>
          <button type="submit" className="btn-primary btn-primary-block">
            Speichern
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EventDetailModal({
  event,
  contact,
  onEdit,
  onDelete,
  onExportToCalendar,
  onClose,
}) {
  return (
    <Modal onClose={onClose}>
      <div className="detail">
        <div className="detail-head">
          <div className="detail-title">{event.title}</div>
          <div className="detail-sender">
            {formatDate(event.date)}
            {event.time && ` · ${event.time}`}
          </div>
        </div>

        {contact && (
          <section className="detail-section">
            <h3 className="detail-heading">Kontakt</h3>
            <div className="detail-text">{contact.name}</div>
          </section>
        )}

        {event.notes && (
          <section className="detail-section">
            <h3 className="detail-heading">Notizen</h3>
            <p className="detail-text">{event.notes}</p>
          </section>
        )}

        <button
          type="button"
          className="btn-secondary btn-primary-block"
          onClick={onExportToCalendar}
        >
          Zu Kalender hinzufügen
        </button>

        <div className="detail-actions detail-actions-row">
          <button type="button" className="btn-secondary" onClick={onDelete}>
            Löschen
          </button>
          <button type="button" className="btn-primary" onClick={onEdit}>
            Bearbeiten
          </button>
        </div>
      </div>
    </Modal>
  );
}

function normalizeCompact(s) {
  return String(s || "").replace(/[\s\-./]/g, "").toLowerCase();
}

function parseAmountQuery(s) {
  const t = String(s).replace(/[€\s]/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseDateQuery(s) {
  const t = String(s).trim();
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return null;
}

function makeTextSnippet(text, query, before = 30, after = 60) {
  if (!text) return "";
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text.slice(0, before + after);
  const start = Math.max(0, idx - before);
  const end = Math.min(text.length, idx + query.length + after);
  return (start > 0 ? "…" : "") + text.slice(start, end).replace(/\s+/g, " ") + (end < text.length ? "…" : "");
}

function searchAll(query, { docs, contacts, reminders, events, fileIndex }) {
  const qRaw = query.trim();
  if (!qRaw) return null;
  const q = qRaw.toLowerCase();
  const qCompact = normalizeCompact(qRaw);
  const qAmount = parseAmountQuery(qRaw);
  const qDate = parseDateQuery(qRaw);

  function textField(field, value) {
    if (!value) return null;
    const s = String(value);
    if (s.toLowerCase().includes(q)) return { field, snippet: s };
    if (qCompact && normalizeCompact(s).includes(qCompact)) {
      return { field, snippet: s };
    }
    return null;
  }
  function amountField(field, value) {
    if (qAmount == null || value == null) return null;
    if (Math.abs(Number(value) - qAmount) < 0.005) {
      return { field, snippet: formatAmount(value) };
    }
    return null;
  }
  function dateField(field, value) {
    if (!qDate || !value) return null;
    if (value === qDate) return { field, snippet: formatDate(value) };
    return null;
  }
  function fullTextField(field, value) {
    if (!value) return null;
    const s = String(value);
    const lower = s.toLowerCase();
    if (lower.includes(q)) {
      return { field, snippet: makeTextSnippet(s, qRaw) };
    }
    if (qCompact && normalizeCompact(s).includes(qCompact)) {
      return { field, snippet: makeTextSnippet(s, qRaw) };
    }
    return null;
  }

  const docHits = [];
  for (const d of docs) {
    const match =
      textField("Titel", d.title) ||
      textField("Absender", d.sender) ||
      textField("Kategorie", d.category) ||
      textField("Zusammenfassung", d.summary) ||
      textField("Notiz", d.notes) ||
      textField("Antwortentwurf", d.replyDraft) ||
      fullTextField("Volltext", d.fullText) ||
      amountField("Betrag", d.amount) ||
      dateField("Frist", d.deadline) ||
      dateField("Datum", d.date);
    if (match) docHits.push({ item: d, ...match });
  }
  const contactHits = [];
  for (const c of contacts) {
    const match =
      textField("Name", c.name) ||
      textField("IBAN", c.iban) ||
      textField("BIC", c.bic) ||
      textField("E-Mail", c.email) ||
      textField("Telefon", c.phone) ||
      textField(
        "Adresse",
        [c.street, c.zip, c.city].filter(Boolean).join(" ")
      ) ||
      textField("Notizen", c.notes);
    if (match) contactHits.push({ item: c, ...match });
  }
  const reminderHits = [];
  for (const r of reminders) {
    const match =
      textField("Titel", r.title) ||
      textField("Notiz", r.notes) ||
      dateField("Datum", r.date);
    if (match) reminderHits.push({ item: r, ...match });
  }
  const eventHits = [];
  for (const e of events) {
    const match =
      textField("Titel", e.title) ||
      textField("Notizen", e.notes) ||
      textField("Uhrzeit", e.time) ||
      dateField("Datum", e.date);
    if (match) eventHits.push({ item: e, ...match });
  }
  const localFileHits = [];
  if (fileIndex && Array.isArray(fileIndex.folders)) {
    for (const folder of fileIndex.folders) {
      for (const f of folder.files) {
        const nameMatch =
          f.name.toLowerCase().includes(q) ||
          (qCompact && normalizeCompact(f.name).includes(qCompact));
        if (nameMatch) {
          localFileHits.push({
            item: { ...f, folderId: folder.id, folderName: folder.name },
            field: "Dateiname",
            snippet: f.path,
          });
          continue;
        }
        if (f.text && f.text.toLowerCase().includes(q)) {
          localFileHits.push({
            item: { ...f, folderId: folder.id, folderName: folder.name },
            field: "Inhalt",
            snippet: makeTextSnippet(f.text, qRaw),
          });
        }
      }
    }
  }

  const total =
    docHits.length +
    contactHits.length +
    reminderHits.length +
    eventHits.length +
    localFileHits.length;
  return {
    docs: docHits,
    contacts: contactHits,
    reminders: reminderHits,
    events: eventHits,
    localFiles: localFileHits,
    total,
  };
}

function SearchHit({ icon, title, field, snippet, onClick }) {
  return (
    <button type="button" className="search-hit" onClick={onClick}>
      <div className="search-hit-icon">{icon}</div>
      <div className="search-hit-body">
        <div className="search-hit-title">{title}</div>
        <div className="search-hit-meta">
          <span className="search-hit-field">{field}</span>
          <span className="search-hit-snippet">{snippet}</span>
        </div>
      </div>
    </button>
  );
}

function SearchModal({
  docs,
  contacts,
  reminders,
  events,
  fileIndex,
  showTip,
  onDismissTip,
  onOpenDoc,
  onOpenContact,
  onOpenReminder,
  onOpenEvent,
  onOpenLocalFile,
  onClose,
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(
    () => searchAll(query, { docs, contacts, reminders, events, fileIndex }),
    [query, docs, contacts, reminders, events, fileIndex]
  );

  function pick(handler) {
    return (id) => {
      onClose();
      handler(id);
    };
  }
  const openDoc = pick(onOpenDoc);
  const openContact = pick(onOpenContact);
  const openReminder = pick(onOpenReminder);
  const openEvent = pick(onOpenEvent);
  function openLocalFile(item) {
    onClose();
    onOpenLocalFile(item);
  }

  return (
    <Modal onClose={onClose}>
      <div className="search-modal">
        <div className="search-input-wrap">
          <IconSearch size={20} />
          <input
            ref={inputRef}
            type="text"
            className="search-input-large"
            placeholder="Nach allem suchen — Namen, Beträge, IBANs, Datum…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {showTip && (
          <TabTip text={SEARCH_TIP} onDismiss={onDismissTip} />
        )}

        {!results && (
          <div className="search-empty-state">
            <h3 className="search-empty-title">Was suchst du?</h3>
            <ul className="search-hints">
              <li>
                <strong>230,50</strong> — findet Dokumente mit diesem Betrag
              </li>
              <li>
                <strong>DE12 3456…</strong> — findet Kontakte per IBAN, auch mit Leerzeichen
              </li>
              <li>
                <strong>15.07.2026</strong> — findet Fristen und Termine an diesem Tag
              </li>
              <li>
                <strong>Finanzamt</strong> — Absender, Kontaktnamen, Kategorien
              </li>
              <li>
                <strong>Bußgeld</strong> — sucht auch in Zusammenfassungen und Notizen
              </li>
            </ul>
            <div className="search-shortcut-hint">
              Tipp: <kbd>⌘</kbd>+<kbd>K</kbd> (oder <kbd>Strg</kbd>+<kbd>K</kbd>) öffnet die Suche überall
            </div>
          </div>
        )}

        {results && results.total === 0 && (
          <div className="empty">Keine Treffer für „{query}".</div>
        )}

        {results && results.total > 0 && (
          <div className="search-results">
            {results.docs.length > 0 && (
              <section className="search-group">
                <h4 className="search-group-title">
                  Dokumente <span className="search-group-count">{results.docs.length}</span>
                </h4>
                {results.docs.map((h) => (
                  <SearchHit
                    key={h.item.id}
                    icon="§"
                    title={h.item.title}
                    field={h.field}
                    snippet={h.snippet}
                    onClick={() => openDoc(h.item.id)}
                  />
                ))}
              </section>
            )}
            {results.contacts.length > 0 && (
              <section className="search-group">
                <h4 className="search-group-title">
                  Kontakte <span className="search-group-count">{results.contacts.length}</span>
                </h4>
                {results.contacts.map((h) => (
                  <SearchHit
                    key={h.item.id}
                    icon="◉"
                    title={h.item.name}
                    field={h.field}
                    snippet={h.snippet}
                    onClick={() => openContact(h.item.id)}
                  />
                ))}
              </section>
            )}
            {results.reminders.length > 0 && (
              <section className="search-group">
                <h4 className="search-group-title">
                  Erinnerungen <span className="search-group-count">{results.reminders.length}</span>
                </h4>
                {results.reminders.map((h) => (
                  <SearchHit
                    key={h.item.id}
                    icon="◐"
                    title={h.item.title}
                    field={h.field}
                    snippet={h.snippet}
                    onClick={() => openReminder(h.item.id)}
                  />
                ))}
              </section>
            )}
            {results.events.length > 0 && (
              <section className="search-group">
                <h4 className="search-group-title">
                  Termine <span className="search-group-count">{results.events.length}</span>
                </h4>
                {results.events.map((h) => (
                  <SearchHit
                    key={h.item.id}
                    icon="◆"
                    title={h.item.title}
                    field={h.field}
                    snippet={h.snippet}
                    onClick={() => openEvent(h.item.id)}
                  />
                ))}
              </section>
            )}
            {results.localFiles && results.localFiles.length > 0 && (
              <section className="search-group">
                <h4 className="search-group-title">
                  Lokale Dateien <span className="search-group-count">{results.localFiles.length}</span>
                </h4>
                {results.localFiles.map((h, i) => (
                  <SearchHit
                    key={`${h.item.folderId}-${h.item.path}-${i}`}
                    icon="≡"
                    title={h.item.name}
                    field={h.field}
                    snippet={`${h.item.folderName}/${h.item.path} — ${h.snippet}`}
                    onClick={() => openLocalFile(h.item)}
                  />
                ))}
              </section>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function QrScannerModal({ onScanned, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [status, setStatus] = useState("Kamera wird gestartet…");
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    function stop() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }

    async function start() {
      try {
        const jsQR = await getJsQR();
        if (cancelled) return;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setStatus("Halte den Code in den Rahmen");

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        function tick() {
          if (cancelled) return;
          if (video.readyState !== video.HAVE_ENOUGH_DATA) {
            rafRef.current = requestAnimationFrame(tick);
            return;
          }
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(img.data, img.width, img.height, {
            inversionAttempts: "dontInvert",
          });
          if (code && code.data) {
            cancelled = true;
            stop();
            onScanned(code.data);
            return;
          }
          rafRef.current = requestAnimationFrame(tick);
        }
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        setError(
          e.name === "NotAllowedError"
            ? "Kamerazugriff verweigert. Erlaube den Zugriff im Browser."
            : e.message
        );
      }
    }

    start();
    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal onClose={onCancel}>
      <div className="qr-scanner">
        <div className="detail-head">
          <div className="detail-title">QR/Barcode scannen</div>
        </div>
        <div className="qr-video-wrap">
          <video ref={videoRef} playsInline muted className="qr-video" />
          <canvas ref={canvasRef} style={{ display: "none" }} />
          <div className="qr-scan-frame" />
        </div>
        <div className="qr-status">{status}</div>
        {error && <div className="alert">{error}</div>}
        <div className="detail-actions">
          <button type="button" className="btn-secondary btn-primary-block" onClick={onCancel}>
            Abbrechen
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TemplateFormModal({
  templateType,
  contacts,
  docs,
  defaultSenderName,
  onSubmit,
  onCancel,
}) {
  const tpl = TEMPLATE_TYPES.find((t) => t.id === templateType);
  const [form, setForm] = useState({
    context: "",
    recipientId: "",
    linkedDocId: "",
    senderName: defaultSenderName || "",
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.context.trim()) {
      setError("Beschreibe kurz deinen Kontext.");
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        templateType,
        context: form.context.trim(),
        senderName: form.senderName.trim(),
        recipient: form.recipientId
          ? contacts.find((c) => c.id === form.recipientId) || null
          : null,
        linkedDoc: form.linkedDocId
          ? docs.find((d) => d.id === form.linkedDocId) || null
          : null,
      });
    } catch (e2) {
      setError(e2.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={loading ? undefined : onCancel} dismissable={!loading}>
      <form onSubmit={submit} className="detail">
        <div className="detail-head">
          <div className="detail-title">{tpl?.label || "Vorlage"}</div>
          <div className="detail-sender">{tpl?.desc}</div>
        </div>

        <div className="form-field">
          <label>Worum geht es? *</label>
          <textarea
            className="form-input form-textarea"
            rows={4}
            value={form.context}
            onChange={(e) => set("context", e.target.value)}
            placeholder="z.B. „Kündigung Mobilfunkvertrag zum nächstmöglichen Termin, Kundennr. 12345…"
            autoFocus
          />
        </div>

        <div className="form-field">
          <label>Empfänger (aus Kontakten)</label>
          <select
            className="form-input"
            value={form.recipientId}
            onChange={(e) => set("recipientId", e.target.value)}
          >
            <option value="">— Nicht verknüpfen —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>Bezug auf Dokument</label>
          <select
            className="form-input"
            value={form.linkedDocId}
            onChange={(e) => set("linkedDocId", e.target.value)}
          >
            <option value="">— Kein Bezug —</option>
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>Absender-Name (dein Name)</label>
          <input
            type="text"
            className="form-input"
            value={form.senderName}
            onChange={(e) => set("senderName", e.target.value)}
            placeholder="Max Mustermann"
          />
        </div>

        {error && <div className="onboarding-error">{error}</div>}

        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Abbrechen
          </button>
          <button
            type="submit"
            className="btn-primary btn-primary-block"
            disabled={loading}
          >
            {loading ? "Claude schreibt…" : "Anschreiben erzeugen"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TemplateResultModal({
  result,
  onCopy,
  onPrint,
  onSaveAsDoc,
  onClose,
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleCopy() {
    const text = `Betreff: ${result.subject}\n\n${result.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }

  function handleSave() {
    onSaveAsDoc();
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <Modal onClose={onClose}>
      <div className="detail">
        <div className="detail-head">
          <div className="detail-title">{result.templateLabel}</div>
        </div>

        <section className="detail-section">
          <h3 className="detail-heading">Betreff</h3>
          <p className="detail-text">{result.subject}</p>
        </section>

        <section className="detail-section">
          <div className="detail-heading-row">
            <h3 className="detail-heading">Anschreiben</h3>
            <button type="button" className="copy-btn" onClick={handleCopy}>
              {copied ? "Kopiert" : "Kopieren"}
            </button>
          </div>
          <pre className="code-block">{result.body}</pre>
        </section>

        <div className="print-area" aria-hidden="true">
          <h1>{result.subject}</h1>
          <pre>{result.body}</pre>
        </div>

        <div className="detail-actions detail-actions-stack">
          <button
            type="button"
            className="btn-primary btn-primary-block"
            onClick={onPrint}
          >
            Als PDF drucken
          </button>
          <button
            type="button"
            className="btn-secondary btn-primary-block"
            onClick={handleSave}
            disabled={saved}
          >
            {saved ? "Gespeichert" : "Als Dokument speichern"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TemplatesView({ onPick }) {
  return (
    <div className="view">
      <header className="view-header">
        <h1>Vorlagen</h1>
        <p className="lead">
          Wähle eine Vorlage, beschreibe kurz den Kontext — Claude verfasst das
          Anschreiben.
        </p>
      </header>

      <div className="template-grid">
        {TEMPLATE_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            className="card template-card"
            onClick={() => onPick(t.id)}
          >
            <div className="template-icon">
              <IconTemplate size={22} />
            </div>
            <div className="template-body">
              <div className="template-title">{t.label}</div>
              <div className="template-desc">{t.desc}</div>
            </div>
            <IconChevron />
          </button>
        ))}
      </div>
    </div>
  );
}

function TabTip({ text, onDismiss }) {
  return (
    <div className="tab-tip">
      <div className="tab-tip-body">{text}</div>
      <button
        type="button"
        className="tab-tip-close"
        onClick={onDismiss}
        aria-label="Verstanden"
      >
        Verstanden
      </button>
    </div>
  );
}

function SuccessToast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="success-toast" role="status">
      <span className="success-toast-icon">✓</span>
      <span>{message}</span>
    </div>
  );
}

function DisclaimerModal({ onAcknowledge }) {
  return (
    <Modal onClose={() => {}} dismissable={false}>
      <div className="disclaimer">
        <h2 className="disclaimer-title">Willkommen</h2>
        <p className="disclaimer-text">
          Büro hilft dir, deine Post, Fristen und Termine im Griff zu behalten.
          Die App ersetzt keine Rechtsberatung. Bei komplexen Fällen wende dich
          an einen Anwalt oder Steuerberater.
        </p>
        <button
          type="button"
          className="btn-primary btn-primary-block"
          onClick={onAcknowledge}
        >
          Verstanden
        </button>
      </div>
    </Modal>
  );
}


function AuthConfigMissingScreen() {
  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="onboarding-logo">B</div>
        <h1 className="onboarding-title">Auth nicht konfiguriert</h1>
        <p className="onboarding-text">
          Die Datei <code>frontend/.env</code> braucht{" "}
          <code>VITE_SUPABASE_URL</code> und{" "}
          <code>VITE_SUPABASE_ANON_KEY</code>. Starte den Dev-Server nach dem
          Setzen der Variablen neu.
        </p>
      </div>
    </div>
  );
}

function MigrationPromptModal({ counts, onConfirm, onSkip, busy }) {
  return (
    <Modal onClose={busy ? undefined : onSkip} dismissable={!busy}>
      <div className="detail">
        <div className="detail-head">
          <div className="detail-title">Lokale Daten übernehmen?</div>
        </div>
        <p className="detail-text">
          Auf diesem Gerät finden wir noch Einträge aus der Zeit vor der
          Anmeldung. Sollen wir sie in dein Konto übertragen?
        </p>
        <ul className="migration-list">
          {counts.docs > 0 && <li>{counts.docs} Dokument{counts.docs === 1 ? "" : "e"}</li>}
          {counts.contacts > 0 && <li>{counts.contacts} Kontakt{counts.contacts === 1 ? "" : "e"}</li>}
          {counts.reminders > 0 && <li>{counts.reminders} Erinnerung{counts.reminders === 1 ? "" : "en"}</li>}
          {counts.events > 0 && <li>{counts.events} Termin{counts.events === 1 ? "" : "e"}</li>}
        </ul>
        <p className="detail-muted">
          Nach der Übertragung werden die lokalen Kopien gelöscht.
        </p>
        <div className="detail-actions detail-actions-row">
          <button
            type="button"
            className="btn-secondary"
            onClick={onSkip}
            disabled={busy}
          >
            Überspringen
          </button>
          <button
            type="button"
            className="btn-primary btn-primary-block"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Übertrage…" : "Ins Konto übertragen"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function OnboardingScreen({ session, skipWelcome, onDone }) {
  // Initial step:
  //   - Signed-in already (rare case: closed browser between auth and ready)  → step 3
  //   - Fresh install (no onboarding flag)                                    → step 1 (welcome)
  //   - Onboarding already completed but user is logged out (returning user)  → step 2 (auth)
  const [step, setStep] = useState(() => {
    if (session) return 3;
    if (skipWelcome) return 2;
    return 1;
  });
  const [authMode, setAuthMode] = useState("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  // If Supabase session appears while on step 2, advance to step 3.
  useEffect(() => {
    if (session && step === 2) {
      setStep(3);
    }
  }, [session, step]);

  function resetAuthMessages() {
    setError(null);
    setInfo(null);
  }

  async function handleLogin(e) {
    e.preventDefault();
    resetAuthMessages();
    if (!isValidEmail(email)) {
      setError("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }
    if (!password) {
      setError("Bitte gib dein Passwort ein.");
      return;
    }
    setLoading(true);
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (authErr) setError(authErr.message);
  }

  async function handleRegister(e) {
    e.preventDefault();
    resetAuthMessages();
    if (!isValidEmail(email)) {
      setError("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }
    if (password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    setLoading(true);
    const { data, error: authErr } = await supabase.auth.signUp({
      email,
      password,
    });
    setLoading(false);
    if (authErr) {
      setError(authErr.message);
      return;
    }
    if (!data.session) {
      setAuthMode("check-email");
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    resetAuthMessages();
    if (!isValidEmail(email)) {
      setError("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }
    setLoading(true);
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: window.location.origin }
    );
    setLoading(false);
    if (resetErr) {
      setError(resetErr.message);
      return;
    }
    setInfo("Falls die Adresse bekannt ist, haben wir dir einen Reset-Link geschickt.");
  }

  function finish(landing) {
    onDone(session?.user?.email || "", landing);
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="onboarding-stepper" aria-label={`Schritt ${step} von 3`}>
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`step-dot ${step >= n ? "active" : ""}`}
            />
          ))}
        </div>

        {step === 1 && (
          <>
            <div className="onboarding-logo">B</div>
            <h1 className="onboarding-title">Willkommen bei Büro</h1>
            <p className="onboarding-text">
              Dein persönlicher Assistent für alles was verwaltet werden will —
              Post scannen, Fristen im Blick, Kontakte an einem Ort.
            </p>
            <button
              type="button"
              className="btn-primary btn-primary-block"
              onClick={() => {
                resetAuthMessages();
                setStep(2);
              }}
            >
              Los geht's
            </button>
          </>
        )}

        {step === 2 && authMode === "register" && (
          <form onSubmit={handleRegister}>
            <h1 className="onboarding-title">Konto erstellen</h1>
            <p className="onboarding-text">
              Deine Daten liegen in deinem persönlichen Konto — überall
              zugänglich, sobald du dich anmeldest.
            </p>
            <input
              type="email"
              className="onboarding-input"
              placeholder="max@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
            />
            <input
              type="password"
              className="onboarding-input"
              placeholder="Passwort (min. 8 Zeichen)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            {error && <div className="onboarding-error">{error}</div>}
            <button
              type="submit"
              className="btn-primary btn-primary-block"
              disabled={loading}
            >
              {loading ? "Erstelle Konto…" : "Konto erstellen"}
            </button>
            <div className="auth-links">
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  resetAuthMessages();
                  setAuthMode("login");
                }}
              >
                Schon ein Konto? Anmelden
              </button>
            </div>
          </form>
        )}

        {step === 2 && authMode === "login" && (
          <form onSubmit={handleLogin}>
            <h1 className="onboarding-title">Willkommen zurück</h1>
            <p className="onboarding-text">
              Melde dich mit E-Mail und Passwort an.
            </p>
            <input
              type="email"
              className="onboarding-input"
              placeholder="max@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
            />
            <input
              type="password"
              className="onboarding-input"
              placeholder="Passwort"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {error && <div className="onboarding-error">{error}</div>}
            <button
              type="submit"
              className="btn-primary btn-primary-block"
              disabled={loading}
            >
              {loading ? "Melde an…" : "Anmelden"}
            </button>
            <div className="auth-links">
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  resetAuthMessages();
                  setAuthMode("forgot");
                }}
              >
                Passwort vergessen?
              </button>
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  resetAuthMessages();
                  setAuthMode("register");
                }}
              >
                Noch kein Konto? Registrieren
              </button>
            </div>
          </form>
        )}

        {step === 2 && authMode === "forgot" && (
          <form onSubmit={handleForgot}>
            <h1 className="onboarding-title">Passwort zurücksetzen</h1>
            <p className="onboarding-text">
              Wir schicken dir einen Link zum Ändern deines Passworts.
            </p>
            <input
              type="email"
              className="onboarding-input"
              placeholder="max@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
            />
            {error && <div className="onboarding-error">{error}</div>}
            {info && <div className="onboarding-info">{info}</div>}
            <button
              type="submit"
              className="btn-primary btn-primary-block"
              disabled={loading || !!info}
            >
              {loading ? "Sende…" : "Link senden"}
            </button>
            <div className="auth-links">
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  resetAuthMessages();
                  setAuthMode("login");
                }}
              >
                Zurück zum Login
              </button>
            </div>
          </form>
        )}

        {step === 2 && authMode === "check-email" && (
          <>
            <h1 className="onboarding-title">Prüfe dein Postfach</h1>
            <p className="onboarding-text">
              Wir haben dir eine Bestätigungs-E-Mail an{" "}
              <strong>{email}</strong> geschickt. Klicke den Link darin, um
              dein Konto zu aktivieren — danach kannst du dich hier anmelden.
            </p>
            <button
              type="button"
              className="btn-secondary btn-primary-block"
              onClick={() => {
                resetAuthMessages();
                setAuthMode("login");
              }}
            >
              Zurück zum Login
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="onboarding-title">Büro ist bereit</h1>
            <p className="onboarding-text">
              Laden Sie Ihre ersten Dokumente, Briefe oder Rechnungen über den
              Scan-Tab hoch — Büro erkennt automatisch was wichtig ist und
              behält den Überblick für Sie.
            </p>
            <div className="onboarding-examples">
              <div className="onboarding-examples-label">
                Was Sie hochladen können
              </div>
              <ul className="onboarding-examples-list">
                <li>Behördenbriefe &amp; Mahnungen</li>
                <li>Rechnungen &amp; Zahlungsaufforderungen</li>
                <li>Verträge &amp; wichtige Schreiben</li>
              </ul>
            </div>
            <div className="onboarding-actions">
              <button
                type="button"
                className="btn-primary btn-primary-block"
                onClick={() => finish("scan")}
              >
                Ersten Brief scannen
              </button>
              <button
                type="button"
                className="btn-secondary btn-primary-block"
                onClick={() => finish("home")}
              >
                Direkt zum Dashboard
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Sidebar({
  active,
  onChange,
  userEmail,
  onOpenSearch,
  badges = {},
  themeChoice,
  onCycleTheme,
  onSignOut,
}) {
  const ThemeIcon = THEME_ICON[themeChoice] || IconMonitor;
  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-mark">B</div>
        <div className="logo-text">Büro</div>
      </div>
      <button
        type="button"
        className="sidebar-search"
        onClick={onOpenSearch}
        aria-label="Suche öffnen"
      >
        <IconSearch size={16} />
        <span className="sidebar-search-label">Suchen…</span>
        <span className="sidebar-search-kbd">
          <kbd>⌘</kbd>
          <kbd>K</kbd>
        </span>
      </button>
      <nav className="nav-list">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`nav-item ${active === id ? "active" : ""}`}
            onClick={() => onChange(id)}
          >
            <Icon size={18} />
            <span>{label}</span>
            {badges[id] && <span className="nav-badge" />}
          </button>
        ))}
      </nav>
      {userEmail && (
        <div className="sidebar-user" title={userEmail}>
          <div className="user-avatar">
            <IconUser />
          </div>
          <div className="user-email">{userEmail}</div>
        </div>
      )}
      <button
        type="button"
        className="sidebar-theme"
        onClick={onCycleTheme}
        aria-label={`Design: ${THEME_LABEL[themeChoice]}`}
      >
        <ThemeIcon size={16} />
        <span>{THEME_LABEL[themeChoice]}</span>
      </button>
      {onSignOut && (
        <button
          type="button"
          className="sidebar-signout"
          onClick={onSignOut}
        >
          Abmelden
        </button>
      )}
    </aside>
  );
}

function BottomNav({ active, onChange, badges = {} }) {
  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`bottom-nav-item ${active === id ? "active" : ""}`}
          onClick={() => onChange(id)}
        >
          <Icon size={22} />
          <span>{label}</span>
          {badges[id] && <span className="nav-badge" />}
        </button>
      ))}
    </nav>
  );
}

function HomeView({
  docs,
  reminders,
  onNav,
  onOpenDoc,
  onOpenReminder,
  onAddReminder,
  onAddDeadline,
  onToggleReminder,
  onToggleDocStatus,
  onEditDeadline,
  onOpenAppeal,
}) {
  const [deadlineFilter, setDeadlineFilter] = useState("all");

  const allOpenDeadlines = docs
    .filter((d) => d.deadline && d.status !== "Erledigt")
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  const openDeadlines = allOpenDeadlines.filter(
    (d) => deadlineFilter === "all" || (d.deadlineType || "sonstiges") === deadlineFilter
  );

  const pendingPayments = docs
    .filter((d) => d.amount != null && d.status !== "Erledigt")
    .sort((a, b) => (a.deadline || "9").localeCompare(b.deadline || "9"));
  const paymentsTotal = pendingPayments.reduce(
    (sum, d) => sum + (typeof d.amount === "number" ? d.amount : 0),
    0
  );

  const openCount = docs.filter((d) => d.status === "Offen").length;
  const openReminders = (reminders || [])
    .filter((r) => !r.done)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const deadlineFilters = [
    { id: "all", label: "Alle" },
    ...DEADLINE_TYPES.filter((t) => t !== "sonstiges").map((t) => ({
      id: t,
      label: DEADLINE_TYPE_LABEL[t],
    })),
  ];

  return (
    <div className="view">
      <header className="view-header">
        <h1>Guten Tag</h1>
        <p className="lead">
          Sie haben {openCount} unerledigte{openCount === 1 ? "n" : ""} Vorgang
          {openCount === 1 ? "" : "e"}.
        </p>
      </header>

      <section className="stats">
        <div className="stat">
          <div className="stat-value">{allOpenDeadlines.length}</div>
          <div className="stat-label">Offene Fristen</div>
        </div>
        <div className="stat">
          <div className="stat-value">{docs.length}</div>
          <div className="stat-label">Briefe gesamt</div>
        </div>
      </section>

      <div className="section-title-row">
        <h2 className="section-title section-title-inline">Anstehende Fristen</h2>
        <button
          type="button"
          className="btn-primary btn-primary-sm"
          onClick={onAddDeadline}
        >
          + Frist
        </button>
      </div>
      <div className="filter-pills">
        {deadlineFilters.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`pill ${deadlineFilter === f.id ? "active" : ""}`}
            onClick={() => setDeadlineFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="deadline-list">
        {openDeadlines.length === 0 && (
          <div className="empty">Keine offenen Fristen.</div>
        )}
        {openDeadlines.map((d) => {
          const days = daysUntil(d.deadline);
          const level = deadlineLevel(days);
          const isAppealCase = d.deadlineType === "widerspruch";
          const appealPlanned =
            isAppealCase &&
            reminders.some(
              (r) => r.docId === d.id && r.kind === "appeal" && !r.done
            );
          return (
            <div key={d.id} className="card deadline-card">
              <button
                type="button"
                className="deadline-body"
                onClick={() => onOpenDoc(d.id)}
              >
                <div className="deadline-head">
                  <div className="deadline-info">
                    <div className="deadline-title-row">
                      <span className="deadline-title">{d.title}</span>
                      {appealPlanned ? (
                        <span className="appeal-planned-badge">
                          Widerspruch geplant
                        </span>
                      ) : (
                        <DeadlineTypeBadge type={d.deadlineType} />
                      )}
                    </div>
                    <div className="deadline-sender">{d.sender}</div>
                  </div>
                  <div className={`deadline-days days-${level}`}>
                    {days > 0
                      ? `noch ${days} Tag${days === 1 ? "" : "e"}`
                      : days === 0
                      ? "heute fällig"
                      : "überfällig"}
                  </div>
                </div>
                <div className="progress">
                  <div
                    className={`progress-bar bar-${level}`}
                    style={{ width: `${progressPct(days)}%` }}
                  />
                </div>
                <div className="deadline-foot">
                  Fällig am {formatDate(d.deadline)}
                  {d.amount != null && ` · ${formatAmount(d.amount)}`}
                </div>
              </button>
              {isAppealCase && !appealPlanned && (
                <div className="deadline-appeal-row">
                  <button
                    type="button"
                    className="appeal-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenAppeal(d.id);
                    }}
                  >
                    Widersprechen?
                  </button>
                </div>
              )}
              <CardMenu
                items={[
                  {
                    label: "Als erledigt markieren",
                    onClick: () => onToggleDocStatus(d.id),
                  },
                  {
                    label: "Frist verschieben",
                    onClick: () => onEditDeadline(d.id),
                  },
                ]}
              />
            </div>
          );
        })}
      </div>

      {pendingPayments.length > 0 && (
        <>
          <h2 className="section-title">Anstehende Ausgaben</h2>
          <div className="card payments-card">
            <div className="payments-total">
              <div className="payments-total-label">Summe offen</div>
              <div className="payments-total-value">
                {formatAmount(paymentsTotal)}
              </div>
              <div className="payments-total-sub">
                {pendingPayments.length} Posten
              </div>
            </div>
            <div className="payments-list">
              {pendingPayments.map((d) => {
                const days = d.deadline ? daysUntil(d.deadline) : null;
                const level = days != null ? deadlineLevel(days) : "gray";
                return (
                  <button
                    key={d.id}
                    type="button"
                    className="payment-item"
                    onClick={() => onOpenDoc(d.id)}
                  >
                    <div className="payment-body">
                      <div className="payment-title">{d.title}</div>
                      <div className={`payment-meta days-${level}`}>
                        {d.deadline
                          ? `Fällig ${formatDate(d.deadline)}`
                          : "Ohne Frist"}
                        {d.sender && ` · ${d.sender}`}
                      </div>
                    </div>
                    <div className="payment-amount">{formatAmount(d.amount)}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="section-title-row">
        <h2 className="section-title section-title-inline">Erinnerungen</h2>
        <button
          type="button"
          className="btn-primary btn-primary-sm"
          onClick={onAddReminder}
        >
          + Erinnerung
        </button>
      </div>
      <div className="reminder-list">
        {openReminders.length === 0 && (
          <div className="empty">Keine offenen Erinnerungen.</div>
        )}
        {openReminders.map((r) => {
          const days = daysUntil(r.date);
          const level = deadlineLevel(days);
          return (
            <div key={r.id} className="card reminder-card">
              <button
                type="button"
                className="reminder-check"
                onClick={() => onToggleReminder(r.id)}
                aria-label="Als erledigt markieren"
              />
              <button
                type="button"
                className="reminder-body"
                onClick={() => onOpenReminder(r.id)}
              >
                <div className="reminder-title">{r.title}</div>
                <div className={`reminder-meta days-${level}`}>
                  {formatDate(r.date)}
                  {" · "}
                  {days > 0
                    ? `in ${days} Tag${days === 1 ? "" : "en"}`
                    : days === 0
                    ? "heute"
                    : `${Math.abs(days)} Tag${Math.abs(days) === 1 ? "" : "e"} überfällig`}
                </div>
                {r.orphaned && (
                  <div className="reminder-orphan">Dokument wurde gelöscht</div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <h2 className="section-title">Schnellaktion</h2>
      <button className="card action-card" onClick={() => onNav("scan")}>
        <div className="action-icon">
          <IconCamera size={22} />
        </div>
        <div className="action-text">
          <div className="action-title">Neuen Brief scannen</div>
          <div className="action-sub">Fotografieren oder Datei hochladen</div>
        </div>
        <IconChevron />
      </button>
    </div>
  );
}

const WEEKDAY_HEADERS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTH_NAMES = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

function generateMonthCells(year, month) {
  const first = new Date(year, month, 1);
  const dayOfWeek = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - dayOfWeek + i);
    cells.push({
      iso: isoLocal(d),
      day: d.getDate(),
      inCurrentMonth: d.getMonth() === month,
    });
  }
  return cells;
}

function CalendarView({
  docs,
  reminders,
  events,
  googleEvents,
  contacts,
  onOpenDoc,
  onOpenReminder,
  onOpenEvent,
  onOpenGoogleEvent,
  onAddEvent,
}) {
  const [cursor, setCursor] = useState(
    () => new Date(TODAY.getFullYear(), TODAY.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(() => isoLocal(TODAY));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const todayISO = isoLocal(TODAY);

  const entriesByDay = useMemo(() => {
    const map = new Map();
    function push(iso, kind, item) {
      if (!iso) return;
      if (!map.has(iso)) {
        map.set(iso, { deadline: [], reminder: [], event: [], google: [] });
      }
      map.get(iso)[kind].push(item);
    }
    for (const d of docs) {
      if (d.deadline && d.status !== "Erledigt") push(d.deadline, "deadline", d);
    }
    for (const r of reminders) {
      if (r.date && !r.done) push(r.date, "reminder", r);
    }
    for (const e of events) {
      if (e.date) push(e.date, "event", e);
    }
    for (const ge of googleEvents || []) {
      const iso = ge.start?.date || ge.start?.dateTime?.slice(0, 10);
      if (iso) push(iso, "google", ge);
    }
    return map;
  }, [docs, reminders, events, googleEvents]);

  const cells = useMemo(() => generateMonthCells(year, month), [year, month]);

  const emptyDay = { deadline: [], reminder: [], event: [], google: [] };
  const selectedEntries = entriesByDay.get(selectedDate) || emptyDay;
  const selectedIsEmpty =
    selectedEntries.deadline.length === 0 &&
    selectedEntries.reminder.length === 0 &&
    selectedEntries.event.length === 0 &&
    selectedEntries.google.length === 0;

  const agenda = useMemo(() => {
    const days = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(
        TODAY.getFullYear(),
        TODAY.getMonth(),
        TODAY.getDate() + i
      );
      const iso = isoLocal(d);
      const entries = entriesByDay.get(iso);
      if (
        entries &&
        (entries.deadline.length ||
          entries.reminder.length ||
          entries.event.length ||
          entries.google.length)
      ) {
        days.push({ iso, entries });
      }
    }
    return days;
  }, [entriesByDay]);

  function contactName(id) {
    if (!id) return null;
    const c = contacts.find((x) => x.id === id);
    return c ? c.name : null;
  }

  return (
    <div className="view">
      <header className="view-header">
        <h1>Kalender</h1>
        <p className="lead">
          Alle Fristen, Erinnerungen und Termine in einer Ansicht.
        </p>
      </header>

      <div className="calendar-nav">
        <button
          type="button"
          className="calendar-nav-btn"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          aria-label="Voriger Monat"
        >
          ‹
        </button>
        <div className="calendar-title">
          {MONTH_NAMES[month]} {year}
        </div>
        <button
          type="button"
          className="calendar-nav-btn"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          aria-label="Nächster Monat"
        >
          ›
        </button>
      </div>

      <div className="calendar-grid">
        {WEEKDAY_HEADERS.map((h) => (
          <div key={h} className="calendar-weekday">
            {h}
          </div>
        ))}
        {cells.map((cell) => {
          const entry = entriesByDay.get(cell.iso);
          const isToday = cell.iso === todayISO;
          const isSelected = cell.iso === selectedDate;
          const classes = [
            "calendar-cell",
            isToday ? "today" : "",
            isSelected ? "selected" : "",
            cell.inCurrentMonth ? "" : "out-of-month",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={cell.iso}
              type="button"
              className={classes}
              onClick={() => setSelectedDate(cell.iso)}
            >
              <span className="calendar-day">{cell.day}</span>
              {entry && (
                <div className="calendar-dots">
                  {entry.deadline.length > 0 && (
                    <span className="calendar-dot dot-red" />
                  )}
                  {entry.reminder.length > 0 && (
                    <span className="calendar-dot dot-amber" />
                  )}
                  {entry.event.length > 0 && (
                    <span className="calendar-dot dot-blue" />
                  )}
                  {entry.google.length > 0 && (
                    <span className="calendar-dot dot-slate" />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="day-panel">
        <div className="day-panel-head">
          <div className="day-panel-title">{formatDate(selectedDate)}</div>
          <button
            type="button"
            className="btn-primary btn-primary-sm"
            onClick={() => onAddEvent(selectedDate)}
          >
            + Termin
          </button>
        </div>
        <div className="day-entries">
          {selectedIsEmpty && (
            <div className="empty">Keine Einträge an diesem Tag.</div>
          )}
          {selectedEntries.deadline.map((d) => (
            <button
              key={d.id}
              type="button"
              className="day-entry"
              onClick={() => onOpenDoc(d.id)}
            >
              <span className="entry-marker marker-red" />
              <div className="entry-body">
                <div className="entry-title">{d.title}</div>
                <div className="entry-meta">
                  Frist
                  {d.deadlineType &&
                    ` · ${DEADLINE_TYPE_LABEL[d.deadlineType]}`}
                  {d.sender && ` · ${d.sender}`}
                </div>
              </div>
            </button>
          ))}
          {selectedEntries.reminder.map((r) => (
            <button
              key={r.id}
              type="button"
              className="day-entry"
              onClick={() => onOpenReminder(r.id)}
            >
              <span className="entry-marker marker-amber" />
              <div className="entry-body">
                <div className="entry-title">{r.title}</div>
                <div className="entry-meta">Erinnerung</div>
              </div>
            </button>
          ))}
          {selectedEntries.event.map((e) => {
            const cName = contactName(e.contactId);
            return (
              <button
                key={e.id}
                type="button"
                className="day-entry"
                onClick={() => onOpenEvent(e.id)}
              >
                <span className="entry-marker marker-blue" />
                <div className="entry-body">
                  <div className="entry-title">{e.title}</div>
                  <div className="entry-meta">
                    {e.time || "Termin"}
                    {cName && ` · ${cName}`}
                  </div>
                </div>
              </button>
            );
          })}
          {selectedEntries.google.map((ge) => {
            const time = ge.start?.dateTime?.slice(11, 16);
            return (
              <button
                key={"g" + ge.id}
                type="button"
                className="day-entry"
                onClick={() => onOpenGoogleEvent(ge)}
              >
                <span className="entry-marker marker-slate" />
                <div className="entry-body">
                  <div className="entry-title">
                    {ge.summary || "(Ohne Titel)"}
                  </div>
                  <div className="entry-meta">
                    Google Calendar
                    {time && ` · ${time}`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <h2 className="section-title">Kommende 30 Tage</h2>
      <div className="agenda">
        {agenda.length === 0 && (
          <div className="empty">Keine anstehenden Einträge.</div>
        )}
        {agenda.map((day) => (
          <div key={day.iso} className="agenda-day">
            <div className="agenda-date">{formatDate(day.iso)}</div>
            <div className="agenda-entries">
              {day.entries.deadline.map((d) => (
                <button
                  key={"d" + d.id}
                  type="button"
                  className="agenda-entry"
                  onClick={() => onOpenDoc(d.id)}
                >
                  <span className="calendar-dot dot-red" />
                  <span className="agenda-title">{d.title}</span>
                  <span className="agenda-kind">Frist</span>
                </button>
              ))}
              {day.entries.reminder.map((r) => (
                <button
                  key={"r" + r.id}
                  type="button"
                  className="agenda-entry"
                  onClick={() => onOpenReminder(r.id)}
                >
                  <span className="calendar-dot dot-amber" />
                  <span className="agenda-title">{r.title}</span>
                  <span className="agenda-kind">Erinnerung</span>
                </button>
              ))}
              {day.entries.event.map((e) => (
                <button
                  key={"e" + e.id}
                  type="button"
                  className="agenda-entry"
                  onClick={() => onOpenEvent(e.id)}
                >
                  <span className="calendar-dot dot-blue" />
                  <span className="agenda-title">{e.title}</span>
                  <span className="agenda-kind">
                    {e.time ? e.time : "Termin"}
                  </span>
                </button>
              ))}
              {day.entries.google.map((ge) => (
                <button
                  key={"g" + ge.id}
                  type="button"
                  className="agenda-entry"
                  onClick={() => onOpenGoogleEvent(ge)}
                >
                  <span className="calendar-dot dot-slate" />
                  <span className="agenda-title">
                    {ge.summary || "(Ohne Titel)"}
                  </span>
                  <span className="agenda-kind">Google</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatBytes(n) {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function LegalModal({ type, onClose }) {
  const info = LEGAL_TEXTS[type];
  if (!info) return null;
  return (
    <Modal onClose={onClose}>
      <div className="detail">
        <div className="detail-head">
          <div className="detail-title">{info.title}</div>
        </div>
        <div className="legal-text">{info.body}</div>
      </div>
    </Modal>
  );
}

function SettingsView({
  folders,
  folderStatus,
  indexing,
  themeChoice,
  onSetTheme,
  onAddFolder,
  onRemoveFolder,
  onRefreshFolder,
  userEmail,
  onUpdateEmail,
  notifPerm,
  onRequestNotif,
  onExportData,
  onDeleteAll,
  googleConnected,
  googleBusy,
  googleAutoExport,
  googleShowCalendar,
  onGoogleConnect,
  onGoogleDisconnect,
  onSetGoogleAutoExport,
  onSetGoogleShowCalendar,
  onExportCalendar,
}) {
  const [emailEditing, setEmailEditing] = useState(false);
  const [emailDraft, setEmailDraft] = useState(userEmail || "");
  const [emailError, setEmailError] = useState(null);
  const [legalOpen, setLegalOpen] = useState(null);

  function saveEmail() {
    const v = emailDraft.trim();
    if (v && !isValidEmail(v)) {
      setEmailError("Ungültige E-Mail-Adresse.");
      return;
    }
    onUpdateEmail(v);
    setEmailEditing(false);
    setEmailError(null);
  }

  function cancelEmailEdit() {
    setEmailDraft(userEmail || "");
    setEmailEditing(false);
    setEmailError(null);
  }

  const notifStatus =
    notifPerm === "granted"
      ? "Aktiv — Browser darf Erinnerungen zeigen"
      : notifPerm === "denied"
      ? "Blockiert — im Browser-Menü ändern"
      : notifPerm === "unsupported"
      ? "In diesem Browser nicht verfügbar"
      : "Noch nicht aktiviert";

  return (
    <div className="view">
      <header className="view-header">
        <h1>Einstellungen</h1>
        <p className="lead">
          Konto, App-Einstellungen, Datei-Freigabe und Rechtliches.
        </p>
      </header>

      {/* KONTO */}
      <section className="settings-section">
        <h2 className="settings-section-title">Konto</h2>
        <div className="settings-group">
          <div className="settings-row">
            <div className="settings-row-body">
              <div className="settings-row-label">E-Mail</div>
              {emailEditing ? (
                <>
                  <input
                    type="email"
                    className="form-input settings-inline-input"
                    value={emailDraft}
                    onChange={(e) => {
                      setEmailDraft(e.target.value);
                      setEmailError(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && saveEmail()}
                    autoFocus
                  />
                  {emailError && (
                    <div className="settings-row-error">{emailError}</div>
                  )}
                </>
              ) : (
                <div className="settings-row-value">{userEmail || "—"}</div>
              )}
            </div>
            {emailEditing ? (
              <div className="settings-row-actions">
                <button
                  type="button"
                  className="btn-secondary btn-primary-sm"
                  onClick={cancelEmailEdit}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  className="btn-primary btn-primary-sm"
                  onClick={saveEmail}
                >
                  Speichern
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn-secondary btn-primary-sm"
                onClick={() => setEmailEditing(true)}
              >
                Ändern
              </button>
            )}
          </div>
          <div className="settings-row">
            <div className="settings-row-body">
              <div className="settings-row-label">Daten exportieren</div>
              <div className="settings-row-sub">
                Alle Dokumente, Kontakte, Erinnerungen und Termine als JSON.
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary btn-primary-sm"
              onClick={onExportData}
            >
              Herunterladen
            </button>
          </div>
          <div className="settings-row">
            <div className="settings-row-body">
              <div className="settings-row-label">Alle Daten löschen</div>
              <div className="settings-row-sub">
                Setzt die App komplett zurück. Kann nicht rückgängig gemacht
                werden.
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary btn-danger btn-primary-sm"
              onClick={onDeleteAll}
            >
              Löschen
            </button>
          </div>
        </div>
      </section>

      {/* APP */}
      <section className="settings-section">
        <h2 className="settings-section-title">App</h2>
        <div className="settings-group">
          <div className="settings-row">
            <div className="settings-row-body">
              <div className="settings-row-label">Design</div>
              <div className="settings-row-sub">
                „System" folgt der Einstellung deines Betriebssystems.
              </div>
            </div>
            <div className="filter-pills settings-inline-pills">
              {THEME_CHOICES.map((choice) => {
                const Icon = THEME_ICON[choice];
                return (
                  <button
                    key={choice}
                    type="button"
                    className={`pill ${themeChoice === choice ? "active" : ""}`}
                    onClick={() => onSetTheme(choice)}
                  >
                    <Icon size={13} />
                    <span>{THEME_LABEL[choice]}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-body">
              <div className="settings-row-label">Sprache</div>
            </div>
            <div className="filter-pills settings-inline-pills">
              <button type="button" className="pill active" disabled>
                Deutsch
              </button>
              <button
                type="button"
                className="pill"
                disabled
                title="Kommt bald"
              >
                English (bald)
              </button>
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-row-body">
              <div className="settings-row-label">Benachrichtigungen</div>
              <div className="settings-row-sub">{notifStatus}</div>
            </div>
            {notifPerm === "default" && (
              <button
                type="button"
                className="btn-secondary btn-primary-sm"
                onClick={onRequestNotif}
              >
                Aktivieren
              </button>
            )}
          </div>
        </div>
      </section>

      {/* GOOGLE */}
      <section className="settings-section">
        <h2 className="settings-section-title">Google Calendar</h2>
        {!GOOGLE_CONFIGURED ? (
          <div className="card empty-card">
            <div className="empty-title">Noch nicht konfiguriert</div>
            <div className="empty-sub">
              Setze <code>VITE_GOOGLE_CLIENT_ID</code> in der Datei{" "}
              <code>frontend/.env</code>, damit die Verknüpfung sichtbar wird.
            </div>
          </div>
        ) : (
          <div className="settings-group">
            <div className="settings-row">
              <div className="settings-row-body">
                <div className="settings-row-label">
                  {googleConnected ? "Verbunden" : "Nicht verbunden"}
                </div>
                <div className="settings-row-sub">
                  {googleConnected
                    ? "Zugriff aktiv — Büro darf Einträge erstellen und lesen."
                    : "Melde dich mit deinem Google-Konto an, um Fristen und Termine zu synchronisieren."}
                </div>
              </div>
              {googleConnected ? (
                <button
                  type="button"
                  className="btn-secondary btn-primary-sm"
                  onClick={onGoogleDisconnect}
                  disabled={googleBusy}
                >
                  Trennen
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary btn-primary-sm"
                  onClick={onGoogleConnect}
                  disabled={googleBusy}
                >
                  {googleBusy ? "Verbinde…" : "Mit Google verbinden"}
                </button>
              )}
            </div>
            <div className="settings-row">
              <div className="settings-row-body">
                <div className="settings-row-label">
                  Neue Einträge automatisch zu Google
                </div>
                <div className="settings-row-sub">
                  Fristen, Erinnerungen und Termine werden nach dem Speichern
                  automatisch in deinen Google-Kalender geschrieben.
                </div>
              </div>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={googleAutoExport}
                  onChange={(e) => onSetGoogleAutoExport(e.target.checked)}
                  disabled={!googleConnected}
                />
                <span className="settings-switch-track" />
              </label>
            </div>
            <div className="settings-row">
              <div className="settings-row-body">
                <div className="settings-row-label">
                  Google-Termine im Kalender anzeigen
                </div>
                <div className="settings-row-sub">
                  Zeigt deine nächsten 30 Tage aus Google Calendar als
                  eigene Farbe im Kalender-Tab.
                </div>
              </div>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={googleShowCalendar}
                  onChange={(e) => onSetGoogleShowCalendar(e.target.checked)}
                  disabled={!googleConnected}
                />
                <span className="settings-switch-track" />
              </label>
            </div>
          </div>
        )}
        <p className="settings-hint">
          Deine Google-Daten verlassen nie Büro ohne deine Erlaubnis. Alle
          Aufrufe laufen direkt aus dem Browser gegen die Google API — kein
          Server dazwischen.
        </p>
      </section>

      {/* KALENDER-EXPORT (.ics) */}
      <section className="settings-section">
        <h2 className="settings-section-title">Kalender-Export</h2>
        <div className="settings-group">
          <button
            type="button"
            className="settings-row settings-row-link"
            onClick={() => onExportCalendar("all")}
          >
            <div className="settings-row-body">
              <div className="settings-row-label">Alle Einträge exportieren</div>
              <div className="settings-row-sub">
                Fristen, Erinnerungen und Termine als .ics-Datei.
              </div>
            </div>
            <IconChevron />
          </button>
          <button
            type="button"
            className="settings-row settings-row-link"
            onClick={() => onExportCalendar("deadlines")}
          >
            <div className="settings-row-body">
              <div className="settings-row-label">Nur offene Fristen</div>
              <div className="settings-row-sub">
                Nur Doc-Fristen die noch nicht erledigt sind.
              </div>
            </div>
            <IconChevron />
          </button>
          <button
            type="button"
            className="settings-row settings-row-link"
            onClick={() => onExportCalendar("reminders")}
          >
            <div className="settings-row-body">
              <div className="settings-row-label">Nur Erinnerungen</div>
              <div className="settings-row-sub">
                Alle offenen Erinnerungen als .ics-Datei.
              </div>
            </div>
            <IconChevron />
          </button>
        </div>
        <p className="settings-hint">
          Funktioniert mit Apple Kalender, Google Kalender, Outlook und allen
          anderen Kalender-Apps, die .ics-Dateien unterstützen. Auf iOS/macOS
          öffnet sich beim Antippen der Datei direkt der Apple Kalender.
        </p>
      </section>

      {/* LOKALE DATEIEN */}
      <section className="settings-section">
        <h2 className="settings-section-title">Lokale Dateien</h2>
        {FS_SUPPORTED ? (
          <>
            <p className="settings-text">
              Gib einen Ordner frei — Büro liest die Dateien darin lokal im
              Browser aus und macht alles über die Schnellsuche auffindbar.
              PDFs per PDF.js, Bilder per Tesseract-OCR (Deutsch + Englisch).
              Nichts verlässt dein Gerät.
            </p>
            <p className="settings-text">
              Max. {FILE_INDEX_MAX_FILES} Dateien pro Ordner. Bilder über 2 MB
              werden übersprungen. Der erste OCR-Aufruf lädt einmal ~15 MB
              Sprachdaten (aus Browser-Cache danach schnell).
            </p>

            <div className="settings-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={onAddFolder}
                disabled={indexing.active}
              >
                {indexing.active ? "Indiziere…" : "Ordner freigeben"}
              </button>
            </div>

            {indexing.active && (
              <div className="index-progress">
                <div className="index-progress-label">
                  {indexing.current}/{indexing.total} · {indexing.name || "…"}
                </div>
                <div className="progress">
                  <div
                    className="progress-bar bar-amber"
                    style={{
                      width: `${Math.max(4, Math.min(100, (indexing.current / Math.max(1, indexing.total)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="folder-list">
              {folders.length === 0 && !indexing.active && (
                <div className="empty">Noch keine Ordner freigegeben.</div>
              )}
              {folders.map((f) => {
                const status = folderStatus[f.id] || "unknown";
                const stale = status === "stale" || status === "missing";
                const skippedCount = f.files.filter((x) => x.skipped).length;
                return (
                  <div key={f.id} className="card folder-card">
                    <div className="folder-body">
                      <div className="folder-name-row">
                        <IconFile size={16} />
                        <span className="folder-name">{f.name}</span>
                        {stale && (
                          <span className="folder-badge">
                            {status === "missing"
                              ? "Handle verloren"
                              : "Zugriff abgelaufen"}
                          </span>
                        )}
                      </div>
                      <div className="folder-meta">
                        {f.files.length} Datei
                        {f.files.length === 1 ? "" : "en"}
                        {skippedCount > 0 &&
                          ` · ${skippedCount} übersprungen (Bild > 2 MB)`}
                        {f.indexedAt &&
                          ` · zuletzt indiziert ${formatDate(f.indexedAt)}`}
                      </div>
                    </div>
                    <div className="folder-actions">
                      {stale && status !== "missing" && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => onRefreshFolder(f.id)}
                        >
                          Zugriff erneuern
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-secondary btn-danger"
                        onClick={() => onRemoveFolder(f.id)}
                      >
                        Entfernen
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="settings-hint">
              Funktioniert nur in Chrome und Edge. Safari unterstützt die File
              System Access API nicht.
            </p>
          </>
        ) : (
          <div className="card empty-card">
            <div className="empty-title">Nicht unterstützt</div>
            <div className="empty-sub">
              Lokale Ordner können nur in Chrome oder Edge freigegeben werden.
              Safari unterstützt die File System Access API nicht.
            </div>
          </div>
        )}
      </section>

      {/* SUPPORT & FEEDBACK */}
      <section className="settings-section">
        <h2 className="settings-section-title">Support & Feedback</h2>
        <div className="settings-group">
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Feedback zu Büro")}`}
            className="settings-row settings-row-link"
          >
            <div className="settings-row-body">
              <div className="settings-row-label">Feedback senden</div>
              <div className="settings-row-sub">
                Was funktioniert? Was nervt? Schreib uns.
              </div>
            </div>
            <IconChevron />
          </a>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Feature-Idee für Büro")}`}
            className="settings-row settings-row-link"
          >
            <div className="settings-row-body">
              <div className="settings-row-label">Feature vorschlagen</div>
              <div className="settings-row-sub">
                Welche Funktion würde dir am meisten helfen?
              </div>
            </div>
            <IconChevron />
          </a>
          <div className="settings-row">
            <div className="settings-row-body">
              <div className="settings-row-label">Version</div>
            </div>
            <div className="settings-row-value settings-mono">
              v{APP_VERSION}
            </div>
          </div>
        </div>
      </section>

      {/* ABO */}
      <section className="settings-section">
        <h2 className="settings-section-title">Abo</h2>
        <div className="settings-group">
          <div className="settings-row">
            <div className="settings-row-body">
              <div className="settings-row-label">Aktueller Plan</div>
              <div className="settings-row-sub">
                Voller Funktionsumfang, kostenlos.
              </div>
            </div>
            <span className="badge badge-green">Büro Free</span>
          </div>
          <div className="settings-row settings-row-muted">
            <div className="settings-row-body">
              <div className="settings-row-label">Pro Plan</div>
              <div className="settings-row-sub">
                Cloud-Sync, geteilte Ordner, Priority-Support — kommt bald.
              </div>
            </div>
            <span className="badge badge-gray">Coming soon</span>
          </div>
        </div>
      </section>

      {/* RECHTLICHES */}
      <section className="settings-section">
        <h2 className="settings-section-title">Rechtliches</h2>
        <div className="settings-group">
          <button
            type="button"
            className="settings-row settings-row-link"
            onClick={() => setLegalOpen("impressum")}
          >
            <div className="settings-row-body">
              <div className="settings-row-label">Impressum</div>
            </div>
            <IconChevron />
          </button>
          <button
            type="button"
            className="settings-row settings-row-link"
            onClick={() => setLegalOpen("datenschutz")}
          >
            <div className="settings-row-body">
              <div className="settings-row-label">Datenschutzerklärung</div>
            </div>
            <IconChevron />
          </button>
          <button
            type="button"
            className="settings-row settings-row-link"
            onClick={() => setLegalOpen("agb")}
          >
            <div className="settings-row-body">
              <div className="settings-row-label">Nutzungsbedingungen</div>
            </div>
            <IconChevron />
          </button>
        </div>
      </section>

      {legalOpen && (
        <LegalModal type={legalOpen} onClose={() => setLegalOpen(null)} />
      )}
    </div>
  );
}

function ScanView({ docs, isFirstScan, onScanned, onOpenDoc }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [analyzingQr, setAnalyzingQr] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("document", file);
      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const result = await res.json();
      onScanned({ ...result, filename: file.name });
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleQrScanned(text) {
    setQrOpen(false);
    setError(null);
    setAnalyzingQr(true);
    try {
      const res = await fetch(`${API_BASE}/api/qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const result = await res.json();
      onScanned({ ...result, filename: "QR-Code" });
    } catch (e) {
      setError("QR-Analyse: " + e.message);
    } finally {
      setAnalyzingQr(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  return (
    <div className="view">
      <header className="view-header">
        <h1>Scannen</h1>
        <p className="lead">Dokument hochladen oder mit Kamera aufnehmen.</p>
      </header>

      {isFirstScan && (
        <div className="first-scan-coach">
          <div className="first-scan-coach-head">Dein erster Scan</div>
          <div className="first-scan-coach-body">
            Zieh eine PDF-Datei rein oder tipp auf die Fläche. Claude erkennt
            Absender, Frist und Betrag und schlägt vor, was du damit tun
            kannst.
          </div>
        </div>
      )}

      <div
        className={`dropzone ${dragging ? "dragging" : ""} ${
          uploading ? "uploading" : ""
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <div className="dropzone-icon">
          <IconUpload />
        </div>
        <div className="dropzone-title">
          {uploading ? "Analysiere…" : "Datei hier ablegen oder wählen"}
        </div>
        <div className="dropzone-sub">PDF, JPG oder PNG · max. 15 MB</div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      <button
        className="camera-btn"
        onClick={() => cameraInputRef.current?.click()}
        disabled={uploading || analyzingQr}
      >
        <IconCamera />
        <span>Foto aufnehmen</span>
      </button>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <button
        className="camera-btn"
        onClick={() => setQrOpen(true)}
        disabled={uploading || analyzingQr}
      >
        <IconQr />
        <span>{analyzingQr ? "Claude analysiert QR…" : "QR/Barcode scannen"}</span>
      </button>

      {qrOpen && (
        <QrScannerModal
          onScanned={handleQrScanned}
          onCancel={() => setQrOpen(false)}
        />
      )}

      {error && <div className="alert">Fehler: {error}</div>}

      {docs.length === 0 ? (
        <div className="card scan-empty">
          <div className="scan-empty-title">
            Ihr erstes Dokument wartet darauf erkannt zu werden.
          </div>
          <div className="scan-empty-sub">Büro erkennt zuverlässig:</div>
          <ul className="scan-empty-list">
            <li>Behördenbriefe &amp; Mahnungen</li>
            <li>Rechnungen &amp; Zahlungsaufforderungen</li>
            <li>Verträge &amp; wichtige Schreiben</li>
          </ul>
          <button
            type="button"
            className="btn-primary btn-primary-block"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || analyzingQr}
          >
            Jetzt scannen
          </button>
        </div>
      ) : (
        <>
          <h2 className="section-title">Scan-Verlauf</h2>
          <div className="doc-list">
            {docs.map((d) => (
              <button
                key={d.id}
                type="button"
                className="card doc-card"
                onClick={() => onOpenDoc(d.id)}
              >
                <div className="doc-body">
                  <div className="doc-title">{d.title}</div>
                  <div className="doc-meta">
                    {d.sender} · {formatDate(d.date)}
                  </div>
                </div>
                <StatusBadge status={d.status} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CategoriesView({ docs, onOpenCategory, onNav }) {
  const groups = useMemo(() => {
    const map = new Map();
    for (const d of docs) {
      const cat = d.category || "Sonstiges";
      if (!map.has(cat)) map.set(cat, { total: 0, open: 0 });
      const g = map.get(cat);
      g.total += 1;
      if (d.status !== "Erledigt") g.open += 1;
    }
    return [...map.entries()]
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => b.open - a.open || b.total - a.total || a.name.localeCompare(b.name));
  }, [docs]);

  return (
    <div className="view">
      <header className="view-header">
        <h1>Kategorien</h1>
        <p className="lead">Deine Post nach Absender gruppiert.</p>
      </header>

      {groups.length === 0 ? (
        <div className="card empty-card">
          <div className="empty-title">Noch keine Briefe gescannt</div>
          <div className="empty-sub">
            Sobald du ein Dokument scannst, erscheinen hier automatisch die
            passenden Kategorien.
          </div>
          <button className="btn-primary" onClick={() => onNav("scan")}>
            <IconCamera size={18} />
            <span>Brief scannen</span>
          </button>
        </div>
      ) : (
        <div className="cat-grid">
          {groups.map((g) => (
            <button
              key={g.name}
              className="card cat-card"
              type="button"
              onClick={() => onOpenCategory(g.name)}
            >
              <div className="cat-symbol">{categorySymbol(g.name)}</div>
              <div className="cat-name">{g.name}</div>
              <div className="cat-meta">
                {g.total} Brief{g.total === 1 ? "" : "e"}
                {g.open > 0 && (
                  <>
                    {" · "}
                    <span className="text-red">{g.open} offen</span>
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <h2 className="section-title">Werkzeuge</h2>
      <div className="tool-grid">
        <button className="card tool-card" type="button">
          <div className="tool-title">Widerspruchsgenerator</div>
          <div className="tool-sub">
            Automatisch begründete Widersprüche verfassen
          </div>
        </button>
        <button className="card tool-card" type="button">
          <div className="tool-title">Fristen-Kalender</div>
          <div className="tool-sub">
            Alle Deadlines auf einen Blick, mit Erinnerungen
          </div>
        </button>
      </div>
    </div>
  );
}

const ARCHIVE_SORTS = {
  date_desc: (a, b) => (b.date || "").localeCompare(a.date || ""),
  date_asc: (a, b) => (a.date || "").localeCompare(b.date || ""),
  deadline_asc: (a, b) => {
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return a.deadline.localeCompare(b.deadline);
  },
  deadline_desc: (a, b) => {
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return b.deadline.localeCompare(a.deadline);
  },
};

function ArchiveView({
  docs,
  categoryFilter,
  onClearCategoryFilter,
  onOpenDoc,
  existingCategories,
  onUpdateCategory,
}) {
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("date_desc");
  const [search, setSearch] = useState("");
  const [editingCategoryDocId, setEditingCategoryDocId] = useState(null);

  const years = useMemo(
    () => [...new Set(docs.map((d) => d.date.slice(0, 4)))].sort().reverse(),
    [docs]
  );

  const filtered = docs
    .filter((d) => {
      if (categoryFilter && d.category !== categoryFilter) return false;
      if (filter === "open" && d.status === "Erledigt") return false;
      if (filter === "done" && d.status !== "Erledigt") return false;
      if (filter.startsWith("y-") && !d.date.startsWith(filter.slice(2)))
        return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = [d.title, d.sender, d.category, d.summary]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .sort(ARCHIVE_SORTS[sort] || ARCHIVE_SORTS.date_desc);

  const filters = [
    { id: "all", label: "Alle" },
    { id: "open", label: "Offen" },
    { id: "done", label: "Erledigt" },
    ...years.map((y) => ({ id: `y-${y}`, label: y })),
  ];

  return (
    <div className="view">
      <header className="view-header">
        <h1>Archiv</h1>
        <p className="lead">Alle Dokumente durchsuchen und filtern.</p>
      </header>

      <div className="search-box">
        <IconSearch />
        <input
          type="text"
          placeholder="Suchen nach Titel, Absender oder Inhalt…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {categoryFilter && (
        <button
          type="button"
          className="chip"
          onClick={onClearCategoryFilter}
          aria-label="Kategorie-Filter entfernen"
        >
          <span>Kategorie: {categoryFilter}</span>
          <span className="chip-x" aria-hidden="true">×</span>
        </button>
      )}

      <div className="filter-pills">
        {filters.map((f) => (
          <button
            key={f.id}
            className={`pill ${filter === f.id ? "active" : ""}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="sort-row">
        <label htmlFor="archive-sort" className="sort-label">
          Sortierung
        </label>
        <select
          id="archive-sort"
          className="form-input sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="date_desc">Datum (neueste zuerst)</option>
          <option value="date_asc">Datum (älteste zuerst)</option>
          <option value="deadline_asc">Frist (nächste zuerst)</option>
          <option value="deadline_desc">Frist (späteste zuerst)</option>
        </select>
      </div>

      <div className="doc-list">
        {filtered.length === 0 && (
          <div className="empty">Keine Dokumente gefunden.</div>
        )}
        {filtered.map((d) => {
          if (editingCategoryDocId === d.id) {
            return (
              <div key={d.id} className="card doc-card doc-card-editing">
                <div className="doc-body">
                  <div className="doc-title">{d.title}</div>
                  <div className="doc-meta">Kategorie ändern:</div>
                  <CategoryEditor
                    value={d.category}
                    existingCategories={existingCategories}
                    onChange={(cat) => {
                      onUpdateCategory(d.id, cat);
                      setEditingCategoryDocId(null);
                    }}
                    onCancel={() => setEditingCategoryDocId(null)}
                  />
                </div>
              </div>
            );
          }
          return (
            <div key={d.id} className="card doc-card doc-card-wrap">
              <button
                type="button"
                className="doc-card-body"
                onClick={() => onOpenDoc(d.id)}
              >
                <div className="doc-body">
                  <div className="doc-title-row">
                    <span className="doc-title">{d.title}</span>
                    <DeadlineTypeBadge type={d.deadlineType} />
                  </div>
                  <div className="doc-meta">
                    {d.sender} · {formatDate(d.date)} · {d.category}
                    {d.deadline && ` · Frist ${formatDate(d.deadline)}`}
                  </div>
                  {d.summary && <div className="doc-summary">{d.summary}</div>}
                </div>
                <StatusBadge status={d.status} />
              </button>
              <CardMenu
                items={[
                  {
                    label: "Kategorie ändern",
                    onClick: () => setEditingCategoryDocId(d.id),
                  },
                ]}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function contactTopInfo(c) {
  return c.iban || c.email || c.phone || "";
}

function ContactCard({ contact, onClick }) {
  const top = contactTopInfo(contact);
  return (
    <button type="button" className="card doc-card" onClick={onClick}>
      <div className="doc-body">
        <div className="doc-title">{contact.name}</div>
        {top && <div className="doc-meta">{top}</div>}
      </div>
      <span className="badge badge-neutral">{contact.type}</span>
    </button>
  );
}

function ContactsView({ contacts, onAdd, onOpenDetail }) {
  const [search, setSearch] = useState("");

  const filtered = contacts.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const hay = [c.name, c.iban, c.email, c.phone, c.street, c.zip, c.city]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });

  return (
    <div className="view">
      <header className="view-header">
        <div className="view-header-row">
          <div>
            <h1>Kontakte</h1>
            <p className="lead">
              Behörden, Banken, Vermieter — an einem Ort.
            </p>
          </div>
          {contacts.length > 0 && (
            <button
              type="button"
              className="btn-primary btn-primary-sm"
              onClick={onAdd}
            >
              + Kontakt
            </button>
          )}
        </div>
      </header>

      {contacts.length === 0 ? (
        <div className="card empty-card">
          <div className="empty-title">Noch keine Kontakte</div>
          <div className="empty-sub">
            Füge deinen ersten Kontakt hinzu — z.B. dein Finanzamt oder deine
            Krankenkasse.
          </div>
          <button type="button" className="btn-primary" onClick={onAdd}>
            Kontakt hinzufügen
          </button>
        </div>
      ) : (
        <>
          <div className="search-box">
            <IconSearch />
            <input
              type="text"
              placeholder="Suche in Name, IBAN, E-Mail, Telefon, Adresse…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="doc-list">
            {filtered.length === 0 && (
              <div className="empty">Keine Treffer.</div>
            )}
            {filtered.map((c) => (
              <ContactCard
                key={c.id}
                contact={c}
                onClick={() => onOpenDetail(c.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const CONTACT_DEFAULTS = {
  name: "",
  type: "Sonstiges",
  iban: "",
  bic: "",
  email: "",
  phone: "",
  street: "",
  zip: "",
  city: "",
  notes: "",
};

function ContactFormModal({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    ...CONTACT_DEFAULTS,
    ...(initial || {}),
  }));
  const [error, setError] = useState(null);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name ist ein Pflichtfeld.");
      return;
    }
    onSave({ ...form, name: form.name.trim() });
  }

  return (
    <Modal onClose={onCancel}>
      <form onSubmit={submit} className="detail">
        <div className="detail-head">
          <div className="detail-title">
            {initial ? "Kontakt bearbeiten" : "Kontakt hinzufügen"}
          </div>
        </div>

        <div className="form-field">
          <label>Name *</label>
          <input
            type="text"
            className="form-input"
            value={form.name}
            onChange={(e) => {
              set("name", e.target.value);
              setError(null);
            }}
            autoFocus
          />
        </div>

        <div className="form-field">
          <label>Typ</label>
          <select
            className="form-input"
            value={form.type}
            onChange={(e) => set("type", e.target.value)}
          >
            {CONTACT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="form-grid">
          <div className="form-field">
            <label>IBAN</label>
            <input
              type="text"
              className="form-input"
              value={form.iban}
              onChange={(e) => set("iban", e.target.value)}
              placeholder="DE00 0000 0000 0000 0000 00"
            />
          </div>
          <div className="form-field">
            <label>BIC</label>
            <input
              type="text"
              className="form-input"
              value={form.bic}
              onChange={(e) => set("bic", e.target.value)}
            />
          </div>
        </div>

        <div className="form-grid">
          <div className="form-field">
            <label>E-Mail</label>
            <input
              type="email"
              className="form-input"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Telefon</label>
            <input
              type="tel"
              className="form-input"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
        </div>

        <div className="form-field">
          <label>Straße</label>
          <input
            type="text"
            className="form-input"
            value={form.street}
            onChange={(e) => set("street", e.target.value)}
          />
        </div>

        <div className="form-grid form-grid-zip">
          <div className="form-field">
            <label>PLZ</label>
            <input
              type="text"
              className="form-input"
              value={form.zip}
              onChange={(e) => set("zip", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Ort</label>
            <input
              type="text"
              className="form-input"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </div>
        </div>

        <div className="form-field">
          <label>Notizen</label>
          <textarea
            className="form-input form-textarea"
            rows={3}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>

        {error && <div className="onboarding-error">{error}</div>}

        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
          >
            Abbrechen
          </button>
          <button type="submit" className="btn-primary btn-primary-block">
            Speichern
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ContactDetailModal({ contact, docs, onEdit, onDelete, onClose }) {
  const linkedDocs = docs.filter(
    (d) =>
      contact.name &&
      d.sender &&
      d.sender.toLowerCase().includes(contact.name.toLowerCase())
  );

  const fields = [
    { label: "IBAN", value: contact.iban },
    { label: "BIC", value: contact.bic },
    { label: "E-Mail", value: contact.email },
    { label: "Telefon", value: contact.phone },
  ];

  const addressLines = [
    contact.street,
    [contact.zip, contact.city].filter(Boolean).join(" "),
  ].filter(Boolean);

  return (
    <Modal onClose={onClose}>
      <div className="detail">
        <div className="detail-head">
          <div className="detail-title">{contact.name}</div>
          <div className="detail-badges">
            <span className="badge badge-neutral">{contact.type}</span>
          </div>
        </div>

        {fields.some((f) => f.value) && (
          <section className="detail-section">
            <h3 className="detail-heading">Kontaktdaten</h3>
            <dl className="kv-list">
              {fields.map(
                (f) =>
                  f.value && (
                    <div key={f.label} className="kv-row">
                      <dt>{f.label}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  )
              )}
            </dl>
          </section>
        )}

        {addressLines.length > 0 && (
          <section className="detail-section">
            <h3 className="detail-heading">Adresse</h3>
            <div className="detail-text">
              {addressLines.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          </section>
        )}

        {contact.notes && (
          <section className="detail-section">
            <h3 className="detail-heading">Notizen</h3>
            <p className="detail-text">{contact.notes}</p>
          </section>
        )}

        <section className="detail-section">
          <h3 className="detail-heading">
            Verknüpfte Dokumente ({linkedDocs.length})
          </h3>
          {linkedDocs.length === 0 ? (
            <p className="detail-text detail-muted">
              Keine Dokumente von diesem Absender.
            </p>
          ) : (
            <div className="linked-list">
              {linkedDocs.map((d) => (
                <div key={d.id} className="linked-item">
                  <div className="linked-title">{d.title}</div>
                  <div className="linked-meta">
                    {formatDate(d.date)}
                    {d.deadline && ` · Frist ${formatDate(d.deadline)}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="detail-actions detail-actions-row">
          <button
            type="button"
            className="btn-secondary"
            onClick={onDelete}
          >
            Löschen
          </button>
          <button type="button" className="btn-primary" onClick={onEdit}>
            Bearbeiten
          </button>
        </div>
      </div>
    </Modal>
  );
}

function loadContacts() {
  try {
    const raw = localStorage.getItem(CONTACTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // corrupted / unavailable — fall through
  }
  return [];
}

function loadReminders() {
  try {
    const raw = localStorage.getItem(REMINDERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function loadEvents() {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function loadDocs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // corrupted / unavailable — fall through
  }
  return INITIAL_DOCS;
}

function loadDisclaimerOpen() {
  try {
    return !localStorage.getItem(DISCLAIMER_KEY);
  } catch {
    return false;
  }
}

function loadOnboardingDone() {
  try {
    return !!localStorage.getItem(ONBOARDING_KEY);
  } catch {
    return true;
  }
}

function loadUserEmail() {
  try {
    return localStorage.getItem(EMAIL_KEY) || "";
  } catch {
    return "";
  }
}

function loadTooltipsSeen() {
  try {
    const raw = localStorage.getItem(TIPS_SEEN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {
    // ignore
  }
  return new Set();
}

export default function App() {
  const [tab, setTab] = useState("home");
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [migrationPrompt, setMigrationPrompt] = useState(null);
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [docs, setDocs] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [events, setEvents] = useState([]);
  const docsPrevRef = useRef([]);
  const contactsPrevRef = useRef([]);
  const remindersPrevRef = useRef([]);
  const eventsPrevRef = useRef([]);
  const [pendingResult, setPendingResult] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [contactFormMode, setContactFormMode] = useState("add");
  const [contactFormPrefill, setContactFormPrefill] = useState(null);
  const [selectedReminderId, setSelectedReminderId] = useState(null);
  const [reminderFormOpen, setReminderFormOpen] = useState(false);
  const [reminderFormMode, setReminderFormMode] = useState("add");
  const [reminderFormPrefill, setReminderFormPrefill] = useState(null);
  const [deadlineEditDocId, setDeadlineEditDocId] = useState(null);
  const [manualDeadlineFormOpen, setManualDeadlineFormOpen] = useState(false);
  const [appealDocId, setAppealDocId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [fileIndex, setFileIndex] = useState(loadFileIndex);
  const [folderStatus, setFolderStatus] = useState({});
  const [indexing, setIndexing] = useState({
    active: false,
    current: 0,
    total: 0,
    name: "",
  });
  const folderHandlesRef = useRef(new Map());
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [templateFormType, setTemplateFormType] = useState(null);
  const [templateResult, setTemplateResult] = useState(null);
  const [userName, setUserName] = useState(() => {
    try {
      return localStorage.getItem(USER_NAME_KEY) || "";
    } catch {
      return "";
    }
  });
  const [tooltipsSeen, setTooltipsSeen] = useState(loadTooltipsSeen);
  const [successToast, setSuccessToast] = useState(null);
  const [notifPerm, setNotifPerm] = useState(() => {
    if (typeof Notification === "undefined") return "unsupported";
    return Notification.permission;
  });
  const [googleToken, setGoogleToken] = useState(loadGoogleToken);
  const [googleAutoExport, setGoogleAutoExport] = useState(() =>
    loadBoolPref(GOOGLE_AUTO_EXPORT_KEY, true)
  );
  const [googleShowCalendar, setGoogleShowCalendar] = useState(() =>
    loadBoolPref(GOOGLE_SHOW_CALENDAR_KEY, true)
  );
  const [googleEvents, setGoogleEvents] = useState([]);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [installDismissed, setInstallDismissed] = useState(() => {
    try {
      return localStorage.getItem(INSTALL_DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [browserTipSeen, setBrowserTipSeen] = useState(() => {
    try {
      return localStorage.getItem(BROWSER_TIP_SEEN_KEY) === "1";
    } catch {
      return false;
    }
  });

  function dismissBrowserTip() {
    try {
      localStorage.setItem(BROWSER_TIP_SEEN_KEY, "1");
    } catch {
      // ignore
    }
    setBrowserTipSeen(true);
  }

  const googleConnected =
    !!googleToken && googleToken.expiresAt > Date.now();
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [eventFormMode, setEventFormMode] = useState("add");
  const [eventFormPrefill, setEventFormPrefill] = useState(null);
  const [themeChoice, setThemeChoice] = useState(() => {
    try {
      const v = localStorage.getItem(THEME_KEY);
      return THEME_CHOICES.includes(v) ? v : "system";
    } catch {
      return "system";
    }
  });
  const [disclaimerOpen, setDisclaimerOpen] = useState(loadDisclaimerOpen);
  const [onboardingDone, setOnboardingDone] = useState(loadOnboardingDone);
  const [userEmail, setUserEmail] = useState(loadUserEmail);

  const userId = session?.user?.id || null;

  const [syncError, setSyncError] = useState(null);
  const onSyncError = (table, err) => {
    setSyncError({
      table,
      message: err?.message || String(err),
      hint: /column .* does not exist/i.test(err?.message || "")
        ? "Schema fehlt in Supabase — führe das SQL aus (siehe letzten Task)."
        : null,
    });
  };

  useEffect(() => {
    if (!userId || !dataReady) return;
    const prev = docsPrevRef.current;
    docsPrevRef.current = docs;
    syncDiff("documents", prev, docs, userId, onSyncError);
  }, [docs, userId, dataReady]);

  useEffect(() => {
    if (!userId || !dataReady) return;
    const prev = contactsPrevRef.current;
    contactsPrevRef.current = contacts;
    syncDiff("contacts", prev, contacts, userId, onSyncError);
  }, [contacts, userId, dataReady]);

  useEffect(() => {
    if (!userId || !dataReady) return;
    const prev = remindersPrevRef.current;
    remindersPrevRef.current = reminders;
    syncDiff("reminders", prev, reminders, userId, onSyncError);
  }, [reminders, userId, dataReady]);

  useEffect(() => {
    if (!userId || !dataReady) return;
    const prev = eventsPrevRef.current;
    eventsPrevRef.current = events;
    syncDiff("events", prev, events, userId, onSyncError);
  }, [events, userId, dataReady]);

  useEffect(() => {
    try {
      localStorage.setItem(
        TIPS_SEEN_KEY,
        JSON.stringify([...tooltipsSeen])
      );
    } catch {
      // ignore
    }
  }, [tooltipsSeen]);

  function markTooltipSeen(id) {
    setTooltipsSeen((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  useEffect(() => {
    try {
      localStorage.setItem(FILE_INDEX_KEY, JSON.stringify(fileIndex));
    } catch {
      // storage full — drop the extracted text to save space
      try {
        const trimmed = {
          folders: fileIndex.folders.map((f) => ({
            ...f,
            files: f.files.map((x) => ({ ...x, text: "" })),
          })),
        };
        localStorage.setItem(FILE_INDEX_KEY, JSON.stringify(trimmed));
      } catch {
        // give up
      }
    }
  }, [fileIndex]);

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      setAuthReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setDataReady(false);
        setDocs([]);
        setContacts([]);
        setReminders([]);
        setEvents([]);
        docsPrevRef.current = [];
        contactsPrevRef.current = [];
        remindersPrevRef.current = [];
        eventsPrevRef.current = [];
      }
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAll(userId);
        if (cancelled) return;
        docsPrevRef.current = data.docs;
        contactsPrevRef.current = data.contacts;
        remindersPrevRef.current = data.reminders;
        eventsPrevRef.current = data.events;
        setDocs(data.docs);
        setContacts(data.contacts);
        setReminders(data.reminders);
        setEvents(data.events);
        setDataReady(true);

        // Check for legacy localStorage data to migrate
        const legacy = {
          docs: loadDocs(),
          contacts: loadContacts(),
          reminders: loadReminders(),
          events: loadEvents(),
        };
        const total =
          legacy.docs.length +
          legacy.contacts.length +
          legacy.reminders.length +
          legacy.events.length;
        if (total > 0) {
          setMigrationPrompt({
            legacy,
            counts: {
              docs: legacy.docs.length,
              contacts: legacy.contacts.length,
              reminders: legacy.reminders.length,
              events: legacy.events.length,
            },
          });
        }
      } catch (e) {
        console.error("Initial data load failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function migrateLegacyData() {
    if (!migrationPrompt || !userId) return;
    setMigrationBusy(true);
    const { legacy } = migrationPrompt;
    try {
      await bulkInsert("documents", legacy.docs, userId);
      await bulkInsert("contacts", legacy.contacts, userId);
      await bulkInsert("reminders", legacy.reminders, userId);
      await bulkInsert("events", legacy.events, userId);
      // Merge into current state
      docsPrevRef.current = [...legacy.docs, ...docs];
      contactsPrevRef.current = [...legacy.contacts, ...contacts];
      remindersPrevRef.current = [...legacy.reminders, ...reminders];
      eventsPrevRef.current = [...legacy.events, ...events];
      setDocs((prev) => [...legacy.docs, ...prev]);
      setContacts((prev) => [...legacy.contacts, ...prev]);
      setReminders((prev) => [...legacy.reminders, ...prev]);
      setEvents((prev) => [...legacy.events, ...prev]);
      clearLegacyLocalStorage();
      setMigrationPrompt(null);
    } catch (e) {
      alert("Übertragung fehlgeschlagen: " + e.message);
    } finally {
      setMigrationBusy(false);
    }
  }

  function skipMigration() {
    clearLegacyLocalStorage();
    setMigrationPrompt(null);
  }

  function clearLegacyLocalStorage() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CONTACTS_KEY);
      localStorage.removeItem(REMINDERS_KEY);
      localStorage.removeItem(EVENTS_KEY);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!onboardingDone) return;
    sendDeadlineReminders(docs, reminders);
    // Only run when onboarding transitions to done (returning users on mount,
    // new users after they finish step 3). Docs snapshot at that moment is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingDone]);

  useEffect(() => {
    if (tab !== "calendar") return;
    refreshGoogleEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, googleToken, googleShowCalendar]);

  useEffect(() => {
    function onPrompt(e) {
      e.preventDefault();
      setInstallPromptEvent(e);
    }
    function onInstalled() {
      setInstallPromptEvent(null);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstallClick() {
    if (!installPromptEvent) return;
    try {
      installPromptEvent.prompt();
      await installPromptEvent.userChoice;
    } catch {
      // ignore
    }
    setInstallPromptEvent(null);
  }

  function dismissInstallBanner() {
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
    setInstallDismissed(true);
  }

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, themeChoice);
    } catch {
      // ignore
    }
    const mm =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;
    function apply() {
      const resolved =
        themeChoice === "dark" ||
        (themeChoice === "system" && mm && mm.matches)
          ? "dark"
          : "light";
      document.documentElement.dataset.theme = resolved;
    }
    apply();
    if (themeChoice === "system" && mm) {
      const handler = () => apply();
      if (mm.addEventListener) mm.addEventListener("change", handler);
      else mm.addListener(handler);
      return () => {
        if (mm.removeEventListener) mm.removeEventListener("change", handler);
        else mm.removeListener(handler);
      };
    }
  }, [themeChoice]);

  function cycleTheme() {
    const i = THEME_CHOICES.indexOf(themeChoice);
    setThemeChoice(THEME_CHOICES[(i + 1) % THEME_CHOICES.length]);
  }

  useEffect(() => {
    try {
      if (googleToken) {
        localStorage.setItem(GOOGLE_TOKEN_KEY, JSON.stringify(googleToken));
      } else {
        localStorage.removeItem(GOOGLE_TOKEN_KEY);
      }
    } catch {
      // ignore
    }
  }, [googleToken]);

  useEffect(() => {
    try {
      localStorage.setItem(GOOGLE_AUTO_EXPORT_KEY, googleAutoExport ? "1" : "0");
    } catch {
      // ignore
    }
  }, [googleAutoExport]);

  useEffect(() => {
    try {
      localStorage.setItem(GOOGLE_SHOW_CALENDAR_KEY, googleShowCalendar ? "1" : "0");
    } catch {
      // ignore
    }
  }, [googleShowCalendar]);

  async function connectGoogle() {
    if (!GOOGLE_CONFIGURED) {
      alert(
        "Google Client-ID nicht konfiguriert. Setze VITE_GOOGLE_CLIENT_ID in der .env-Datei."
      );
      return;
    }
    setGoogleBusy(true);
    try {
      const result = await googleSignIn();
      setGoogleToken(result);
    } catch (e) {
      alert("Google-Anmeldung fehlgeschlagen: " + e.message);
    } finally {
      setGoogleBusy(false);
    }
  }

  async function disconnectGoogle() {
    if (googleToken?.accessToken) {
      googleRevoke(googleToken.accessToken).catch(() => {});
    }
    setGoogleToken(null);
    setGoogleEvents([]);
  }

  async function exportItemToGoogle(item, kind) {
    if (!googleConnected) return null;
    const payload = bueroItemToGoogleEvent(item, kind);
    if (!payload) return null;
    try {
      return await googleCreateEvent(googleToken.accessToken, payload);
    } catch (e) {
      if (e.message === "token_expired") {
        setGoogleToken(null);
      }
      // silent for individual exports
      console.error("Google export failed:", e);
      return null;
    }
  }

  function exportCalendarICS(scope) {
    const entries = [];
    if (scope === "all" || scope === "deadlines") {
      for (const d of docs) {
        if (d.deadline && d.status !== "Erledigt") {
          entries.push(docToIcsEntry(d));
        }
      }
    }
    if (scope === "all" || scope === "reminders") {
      for (const r of reminders) {
        if (r.date && !r.done) {
          entries.push(reminderToIcsEntry(r));
        }
      }
    }
    if (scope === "all") {
      for (const e of events) {
        if (e.date) entries.push(eventToIcsEntry(e));
      }
    }
    if (entries.length === 0) {
      alert("Keine passenden Einträge zum Exportieren.");
      return;
    }
    const filename =
      scope === "deadlines"
        ? "buero-fristen.ics"
        : scope === "reminders"
        ? "buero-erinnerungen.ics"
        : "buero-kalender.ics";
    downloadICS(filename, entries);
  }

  function exportDocToICS(doc) {
    if (!doc?.deadline) return;
    downloadICS("buero-frist.ics", [docToIcsEntry(doc)]);
  }

  function exportReminderToICS(reminder) {
    if (!reminder?.date) return;
    downloadICS("buero-erinnerung.ics", [reminderToIcsEntry(reminder)]);
  }

  function exportEventToICS(event) {
    if (!event?.date) return;
    downloadICS("buero-termin.ics", [eventToIcsEntry(event)]);
  }

  async function refreshGoogleEvents() {
    if (!googleConnected || !googleShowCalendar) {
      setGoogleEvents([]);
      return;
    }
    const now = new Date();
    const later = new Date();
    later.setDate(later.getDate() + 30);
    try {
      const data = await googleListEvents(
        googleToken.accessToken,
        now.toISOString(),
        later.toISOString()
      );
      const items = (data.items || []).filter(
        (e) => e.extendedProperties?.private?.source !== "buero"
      );
      setGoogleEvents(items);
    } catch (e) {
      if (e.message === "token_expired") {
        setGoogleToken(null);
        setGoogleEvents([]);
      } else {
        console.error("Failed to load Google events:", e);
      }
    }
  }

  async function requestNotifPermission() {
    if (typeof Notification === "undefined") return;
    try {
      const p = await Notification.requestPermission();
      setNotifPerm(p);
    } catch {
      // ignore
    }
  }

  function updateUserEmail(next) {
    setUserEmail(next);
    try {
      localStorage.setItem(EMAIL_KEY, next);
    } catch {
      // ignore
    }
  }

  function exportAllData() {
    const bundle = {
      exportedAt: new Date().toISOString(),
      version: APP_VERSION,
      email: userEmail,
      userName,
      themeChoice,
      docs,
      contacts,
      reminders,
      events,
      fileIndex,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `buero-export-${isoLocal(TODAY)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function deleteAllData() {
    const first = confirm(
      "Wirklich ALLE Daten löschen? Dokumente, Kontakte, Erinnerungen, Termine und alle Einstellungen gehen verloren."
    );
    if (!first) return;
    const second = confirm(
      "Ganz sicher? Das kann nicht rückgängig gemacht werden."
    );
    if (!second) return;
    // Delete Supabase-side data first (RLS keeps this scoped to user)
    if (userId) {
      try {
        await Promise.all([
          supabase.from("documents").delete().eq("user_id", userId),
          supabase.from("contacts").delete().eq("user_id", userId),
          supabase.from("reminders").delete().eq("user_id", userId),
          supabase.from("events").delete().eq("user_id", userId),
        ]);
      } catch (e) {
        console.error("Cloud delete failed:", e);
      }
    }
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
    try {
      if (typeof indexedDB !== "undefined") {
        indexedDB.deleteDatabase(IDB_NAME);
      }
    } catch {
      // ignore
    }
    try {
      if (session) await supabase.auth.signOut();
    } catch {
      // ignore
    }
    location.reload();
  }

  useEffect(() => {
    if (!FS_SUPPORTED) return;
    let cancelled = false;
    (async () => {
      let stored;
      try {
        stored = await idbGetAll();
      } catch {
        return;
      }
      if (cancelled) return;
      const currentIndex = loadFileIndex();
      const knownIds = new Set(currentIndex.folders.map((f) => f.id));
      for (const { id, handle } of stored) {
        if (knownIds.has(id)) folderHandlesRef.current.set(id, handle);
      }
      const statuses = {};
      for (const folder of currentIndex.folders) {
        const handle = folderHandlesRef.current.get(folder.id);
        if (!handle) {
          statuses[folder.id] = "missing";
          continue;
        }
        try {
          const perm = await handle.queryPermission({ mode: "read" });
          statuses[folder.id] = perm === "granted" ? "granted" : "stale";
        } catch {
          statuses[folder.id] = "stale";
        }
      }
      if (cancelled) return;
      setFolderStatus(statuses);

      for (const folder of currentIndex.folders) {
        if (statuses[folder.id] !== "granted") continue;
        const handle = folderHandlesRef.current.get(folder.id);
        try {
          const { files, changed } = await syncFolderIncremental(
            handle,
            folder.files,
            null
          );
          if (cancelled) return;
          if (changed) {
            setFileIndex((prev) => ({
              folders: prev.folders.map((f) =>
                f.id === folder.id
                  ? { ...f, files, indexedAt: isoLocal(TODAY) }
                  : f
              ),
            }));
          }
        } catch {
          // ignore per-folder sync failures
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedDoc = docs.find((d) => d.id === selectedId);

  function buildDocFromResult(result) {
    const today = isoLocal(TODAY);
    const deadline = result.deadline || null;
    return {
      id: "d" + Date.now(),
      title: result.documentType || result.filename || "Dokument",
      sender: result.sender || "",
      category: result.category || "Sonstiges",
      date: today,
      deadline,
      deadlineType: deadline
        ? (DEADLINE_TYPES.includes(result.deadlineType)
            ? result.deadlineType
            : "sonstiges")
        : null,
      amount: result.amount ?? null,
      summary: result.summary || null,
      fullText: result.fullText || null,
      replyDraft: result.replyDraft || null,
      status: "Offen",
      notes: null,
      filename: result.filename || null,
    };
  }

  function handlePostScanConfirm(chosenActions, overrides = {}) {
    if (!pendingResult) return;
    const doc = buildDocFromResult({
      ...pendingResult,
      ...(overrides.category !== undefined
        ? { category: overrides.category }
        : {}),
    });
    const newReminders = [];
    const newEvents = [];
    const noteParts = [];
    let contactPrefill = null;

    for (const a of chosenActions) {
      if (!a.value) continue;
      if (a.type === "amount") {
        const n = typeof a.value === "number" ? a.value : Number(a.value);
        if (Number.isFinite(n)) doc.amount = n;
      } else if (a.type === "deadline") {
        doc.deadline = a.value;
      } else if (a.type === "note") {
        noteParts.push(String(a.value));
      } else if (a.type === "reminder") {
        newReminders.push({
          id: "r" + Date.now() + Math.random().toString(36).slice(2, 6),
          docId: doc.id,
          title: doc.title,
          date: a.value,
          done: false,
        });
      } else if (a.type === "event" && a.value && typeof a.value === "object") {
        const v = a.value;
        if (v.title && v.date) {
          newEvents.push({
            id: "e" + Date.now() + Math.random().toString(36).slice(2, 6),
            title: v.title,
            date: v.date,
            time: v.time || "",
            notes: v.notes || "",
            contactId: null,
            docId: doc.id,
          });
        }
      } else if (a.type === "contact" && !contactPrefill) {
        const info =
          typeof a.value === "object" && a.value
            ? a.value
            : { name: String(a.value) };
        const name = (info.name || "").trim();
        if (!name) continue;
        const existing = contacts.find(
          (c) => c.name.toLowerCase() === name.toLowerCase()
        );
        if (!existing) {
          const notesParts = [
            info.notes,
            info.website ? `Website: ${info.website}` : null,
          ].filter(Boolean);
          contactPrefill = {
            name,
            type:
              (info.type && CONTACT_TYPES.includes(info.type)
                ? info.type
                : null) ||
              CATEGORY_TO_CONTACT_TYPE[doc.category] ||
              "Sonstiges",
            email: info.email || "",
            phone: info.phone || "",
            street: info.street || "",
            zip: info.zip || "",
            city: info.city || "",
            notes: notesParts.join("\n\n"),
          };
        }
      }
    }

    if (noteParts.length) doc.notes = noteParts.join("\n\n");

    setDocs((prev) => [doc, ...prev]);
    if (newReminders.length) {
      setReminders((prev) => [...newReminders, ...prev]);
    }
    if (newEvents.length) {
      setEvents((prev) => [...newEvents, ...prev]);
    }
    setPendingResult(null);

    if (contactPrefill) {
      setContactFormMode("add");
      setContactFormPrefill(contactPrefill);
      setContactFormOpen(true);
    }

    if (googleConnected && googleAutoExport) {
      if (doc.deadline) exportItemToGoogle(doc, "deadline");
      for (const r of newReminders) exportItemToGoogle(r, "reminder");
      for (const e of newEvents) exportItemToGoogle(e, "event");
    }

    celebrateFirstScan();
  }

  function handlePostScanSkip() {
    if (!pendingResult) return;
    setDocs((prev) => [buildDocFromResult(pendingResult), ...prev]);
    setPendingResult(null);
    celebrateFirstScan();
  }

  function celebrateFirstScan() {
    if (tooltipsSeen.has("first_scan_done")) return;
    markTooltipSeen("first_scan_done");
    markTooltipSeen("scan");
    setSuccessToast("Dein erstes Dokument ist gespeichert.");
    setTab("home");
  }

  function toggleReminder(id) {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, done: !r.done } : r))
    );
  }

  function toggleStatus(id) {
    setDocs((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, status: d.status === "Erledigt" ? "Offen" : "Erledigt" }
          : d
      )
    );
  }

  function deleteDoc(id) {
    const d = docs.find((x) => x.id === id);
    if (!d) return;
    if (!confirm(`Dokument "${d.title}" wirklich löschen?`)) return;
    setDocs((prev) => prev.filter((x) => x.id !== id));
    setReminders((prev) =>
      prev.map((r) =>
        r.docId === id ? { ...r, docId: null, orphaned: true } : r
      )
    );
    setSelectedId(null);
  }

  function openDeadlineEdit(id) {
    setDeadlineEditDocId(id);
  }

  function openManualDeadline() {
    setManualDeadlineFormOpen(true);
  }

  function saveManualDeadline(data) {
    const doc = {
      id: "d" + Date.now(),
      title: data.title,
      sender: data.sender || "",
      category: data.category || "Sonstiges",
      date: isoLocal(TODAY),
      deadline: data.deadline || null,
      deadlineType: data.deadline ? data.deadlineType || "sonstiges" : null,
      amount: data.amount ?? null,
      summary: null,
      replyDraft: null,
      status: "Offen",
      notes: data.notes || null,
      filename: null,
      manual: true,
    };
    setDocs((prev) => [doc, ...prev]);
    setManualDeadlineFormOpen(false);
    if (data.syncToGoogle && doc.deadline) {
      exportItemToGoogle(doc, "deadline");
    }
  }

  function saveDeadlineEdit({ deadline, deadlineType }) {
    if (!deadlineEditDocId) return;
    setDocs((prev) =>
      prev.map((d) =>
        d.id === deadlineEditDocId ? { ...d, deadline, deadlineType } : d
      )
    );
    setDeadlineEditDocId(null);
  }

  function openAddReminder(prefill = null) {
    setReminderFormMode("add");
    setSelectedReminderId(null);
    setReminderFormPrefill(prefill);
    setReminderFormOpen(true);
  }

  function openEditReminder() {
    setReminderFormMode("edit");
    setReminderFormPrefill(null);
    setReminderFormOpen(true);
  }

  function closeReminderForm() {
    setReminderFormOpen(false);
    setReminderFormPrefill(null);
  }

  function saveReminder(data) {
    const { syncToGoogle, ...rest } = data;
    if (reminderFormMode === "edit" && selectedReminderId) {
      setReminders((prev) =>
        prev.map((r) =>
          r.id === selectedReminderId ? { ...r, ...rest } : r
        )
      );
    } else {
      const created = {
        id: "r" + Date.now(),
        done: false,
        ...rest,
      };
      setReminders((prev) => [created, ...prev]);
      if (syncToGoogle && created.date) {
        exportItemToGoogle(created, "reminder");
      }
    }
    closeReminderForm();
  }

  function openAppeal(docId) {
    setAppealDocId(docId);
  }

  function handleAppealScheduleReminder() {
    const d = docs.find((x) => x.id === appealDocId);
    if (!d) return;
    const targetDate = d.deadline
      ? addDays(d.deadline, -7)
      : todayIso();
    const finalDate =
      targetDate < todayIso() ? todayIso() : targetDate;
    setAppealDocId(null);
    openAddReminder({
      title: `Widerspruch vorbereiten: ${d.title}`,
      date: finalDate,
      docId: d.id,
      daysBefore: 3,
      kind: "appeal",
    });
  }

  function handleAppealShowReplyDraft() {
    const id = appealDocId;
    setAppealDocId(null);
    if (id) setSelectedId(id);
  }

  async function addFolder() {
    if (!FS_SUPPORTED) return;
    let handle;
    try {
      handle = await window.showDirectoryPicker({ mode: "read" });
    } catch {
      return;
    }
    const id = "f" + Date.now();
    folderHandlesRef.current.set(id, handle);
    try {
      await idbPut(id, handle);
    } catch {
      // ignore
    }
    setIndexing({ active: true, current: 0, total: 0, name: handle.name });
    try {
      const files = await indexFolderFully(handle, (p) =>
        setIndexing({ active: true, ...p })
      );
      const folder = {
        id,
        name: handle.name,
        addedAt: isoLocal(TODAY),
        indexedAt: isoLocal(TODAY),
        files,
      };
      setFileIndex((prev) => ({ folders: [folder, ...prev.folders] }));
      setFolderStatus((prev) => ({ ...prev, [id]: "granted" }));
    } catch (e) {
      alert("Indizierung fehlgeschlagen: " + e.message);
      folderHandlesRef.current.delete(id);
      idbDelete(id).catch(() => {});
    } finally {
      setIndexing({ active: false, current: 0, total: 0, name: "" });
    }
  }

  async function removeFolder(id) {
    const f = fileIndex.folders.find((x) => x.id === id);
    if (!f) return;
    if (!confirm(`Ordner "${f.name}" entfernen?`)) return;
    folderHandlesRef.current.delete(id);
    try {
      await idbDelete(id);
    } catch {
      // ignore
    }
    setFileIndex((prev) => ({
      folders: prev.folders.filter((x) => x.id !== id),
    }));
    setFolderStatus((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function refreshFolder(id) {
    const handle = folderHandlesRef.current.get(id);
    if (!handle) return;
    try {
      const perm = await handle.requestPermission({ mode: "read" });
      if (perm !== "granted") return;
    } catch {
      return;
    }
    setFolderStatus((prev) => ({ ...prev, [id]: "granted" }));
    setIndexing({ active: true, current: 0, total: 0, name: handle.name });
    try {
      const folder = fileIndex.folders.find((x) => x.id === id);
      const { files } = await syncFolderIncremental(
        handle,
        folder ? folder.files : [],
        (p) => setIndexing({ active: true, ...p })
      );
      setFileIndex((prev) => ({
        folders: prev.folders.map((f) =>
          f.id === id ? { ...f, files, indexedAt: isoLocal(TODAY) } : f
        ),
      }));
    } catch (e) {
      alert("Re-Indizierung fehlgeschlagen: " + e.message);
    } finally {
      setIndexing({ active: false, current: 0, total: 0, name: "" });
    }
  }

  async function openLocalFile(item) {
    const handle = folderHandlesRef.current.get(item.folderId);
    if (!handle) {
      alert("Ordner nicht mehr verfügbar. Bitte im Einstellungen-Tab neu freigeben.");
      return;
    }
    try {
      const perm = await handle.queryPermission({ mode: "read" });
      if (perm !== "granted") {
        const ask = await handle.requestPermission({ mode: "read" });
        if (ask !== "granted") return;
      }
      const file = await resolveFileFromHandle(handle, item.path);
      const url = URL.createObjectURL(file);
      const win = window.open(url, "_blank");
      if (!win) {
        alert("Popup-Blocker verhindert das Öffnen der Datei.");
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      alert("Datei konnte nicht geöffnet werden: " + e.message);
    }
  }

  function openTemplateForm(id) {
    setTemplateResult(null);
    setTemplateFormType(id);
  }

  async function submitTemplateRequest(payload) {
    if (payload.senderName) {
      try {
        localStorage.setItem(USER_NAME_KEY, payload.senderName);
      } catch {
        // ignore
      }
      setUserName(payload.senderName);
    }
    const res = await fetch(`${API_BASE}/api/template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    const result = await res.json();
    setTemplateFormType(null);
    setTemplateResult(result);
  }

  function saveTemplateAsDoc() {
    if (!templateResult) return;
    const doc = {
      id: "d" + Date.now(),
      title: templateResult.subject || templateResult.templateLabel || "Anschreiben",
      sender: userName || "",
      category: "Sonstiges",
      date: isoLocal(TODAY),
      deadline: null,
      deadlineType: null,
      amount: null,
      summary: `Vorlage: ${templateResult.templateLabel}`,
      replyDraft: templateResult.body,
      status: "Offen",
      notes: null,
      filename: null,
      manual: true,
      source: "template",
    };
    setDocs((prev) => [doc, ...prev]);
  }

  function openAddEvent(dateIso) {
    setEventFormMode("add");
    setSelectedEventId(null);
    setEventFormPrefill(dateIso ? { date: dateIso } : null);
    setEventFormOpen(true);
  }

  function openEditEvent() {
    setEventFormMode("edit");
    setEventFormPrefill(null);
    setEventFormOpen(true);
  }

  function closeEventForm() {
    setEventFormOpen(false);
    setEventFormPrefill(null);
  }

  function saveEvent(data) {
    const { syncToGoogle, ...rest } = data;
    if (eventFormMode === "edit" && selectedEventId) {
      setEvents((prev) =>
        prev.map((e) => (e.id === selectedEventId ? { ...e, ...rest } : e))
      );
    } else {
      const created = { id: "e" + Date.now(), ...rest };
      setEvents((prev) => [created, ...prev]);
      if (syncToGoogle && created.date) {
        exportItemToGoogle(created, "event");
      }
    }
    closeEventForm();
  }

  function deleteEvent() {
    if (!selectedEventId) return;
    if (!confirm("Termin wirklich löschen?")) return;
    setEvents((prev) => prev.filter((e) => e.id !== selectedEventId));
    setSelectedEventId(null);
  }

  function deleteReminder() {
    if (!selectedReminderId) return;
    if (!confirm("Erinnerung wirklich löschen?")) return;
    setReminders((prev) => prev.filter((r) => r.id !== selectedReminderId));
    setSelectedReminderId(null);
  }

  function toggleSelectedReminderDone() {
    if (!selectedReminderId) return;
    toggleReminder(selectedReminderId);
  }

  function navigate(nextTab) {
    if (nextTab !== "archive") setCategoryFilter(null);
    setTab(nextTab);
  }

  function openCategory(name) {
    setCategoryFilter(name);
    setTab("archive");
  }

  function openAddContact() {
    setContactFormMode("add");
    setContactFormPrefill(null);
    setContactFormOpen(true);
  }

  function closeContactForm() {
    setContactFormOpen(false);
    setContactFormPrefill(null);
  }

  function saveContact(data) {
    if (contactFormMode === "edit" && selectedContactId) {
      setContacts((prev) =>
        prev.map((c) => (c.id === selectedContactId ? { ...c, ...data } : c))
      );
    } else {
      setContacts((prev) => [{ ...data, id: "c" + Date.now() }, ...prev]);
    }
    closeContactForm();
  }

  function deleteContact() {
    const c = contacts.find((x) => x.id === selectedContactId);
    if (!c) return;
    if (!confirm(`Kontakt "${c.name}" wirklich löschen?`)) return;
    setContacts((prev) => prev.filter((x) => x.id !== selectedContactId));
    setSelectedContactId(null);
  }

  function acknowledgeDisclaimer() {
    try {
      localStorage.setItem(DISCLAIMER_KEY, "1");
    } catch {
      // ignore
    }
    setDisclaimerOpen(false);
  }

  function completeOnboarding(email, landing = "home") {
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      // ignore
    }
    setUserEmail(email);
    setOnboardingDone(true);
    setTab(landing === "scan" ? "scan" : "home");
  }

  async function signOut() {
    if (!confirm("Wirklich abmelden?")) return;
    try {
      await supabase.auth.signOut();
    } catch (e) {
      alert("Abmelden fehlgeschlagen: " + e.message);
    }
  }

  // Derive email from session (Supabase is now the source of truth)
  const authEmail = session?.user?.email || userEmail;

  // Hooks (useMemo etc.) MUST live before any early-return to keep hook order stable.
  const existingCategories = useMemo(() => {
    const set = new Set();
    for (const d of docs) {
      if (d.category) set.add(d.category);
    }
    return [...set].sort();
  }, [docs]);

  if (!authReady) {
    return null;
  }

  if (!SUPABASE_CONFIGURED) {
    return <AuthConfigMissingScreen />;
  }

  // Disclaimer gates everything on fresh install
  if (disclaimerOpen) {
    return (
      <div className="app">
        <DisclaimerModal onAcknowledge={acknowledgeDisclaimer} />
      </div>
    );
  }

  // Onboarding covers ALL not-yet-in-the-app cases:
  //   - Fresh visitor: full 3-step flow (welcome → auth → ready)
  //   - Returning user after logout: same component, jump to step 2 (auth)
  //   - Signed in but didn't finish orientation: jump to step 3 (ready)
  if (!session || !onboardingDone) {
    return (
      <OnboardingScreen
        session={session}
        skipWelcome={onboardingDone}
        onDone={completeOnboarding}
      />
    );
  }

  if (!dataReady) {
    return null;
  }

  const hasStaleFolders = fileIndex.folders.some((f) => {
    const s = folderStatus[f.id];
    return s === "stale" || s === "missing";
  });
  const navBadges = { settings: hasStaleFolders };

  function updateDocCategory(id, category) {
    const trimmed = (category || "").trim();
    if (!trimmed) return;
    setDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, category: trimmed } : d))
    );
  }

  return (
    <div className="app">
      <Sidebar
        active={tab}
        onChange={navigate}
        userEmail={authEmail}
        onOpenSearch={() => setSearchOpen(true)}
        badges={navBadges}
        themeChoice={themeChoice}
        onCycleTheme={cycleTheme}
        onSignOut={signOut}
      />
      <button
        type="button"
        className="search-fab"
        onClick={() => setSearchOpen(true)}
        aria-label="Suche öffnen"
      >
        <IconSearch size={20} />
      </button>
      <main className="main">
        {!FS_SUPPORTED && !browserTipSeen && (
          <TabTip text={BROWSER_TIP_TEXT} onDismiss={dismissBrowserTip} />
        )}
        {TAB_TIPS[tab] &&
          !tooltipsSeen.has(tab) &&
          !(tab === "scan" && !tooltipsSeen.has("first_scan_done")) && (
            <TabTip
              text={TAB_TIPS[tab]}
              onDismiss={() => markTooltipSeen(tab)}
            />
          )}
        {tab === "home" && (
          <HomeView
            docs={docs}
            reminders={reminders}
            onNav={navigate}
            onOpenDoc={setSelectedId}
            onOpenReminder={setSelectedReminderId}
            onAddReminder={() => openAddReminder()}
            onAddDeadline={openManualDeadline}
            onToggleReminder={toggleReminder}
            onToggleDocStatus={toggleStatus}
            onEditDeadline={openDeadlineEdit}
            onOpenAppeal={openAppeal}
          />
        )}
        {tab === "calendar" && (
          <CalendarView
            docs={docs}
            reminders={reminders}
            events={events}
            googleEvents={googleShowCalendar ? googleEvents : []}
            contacts={contacts}
            onOpenDoc={setSelectedId}
            onOpenReminder={setSelectedReminderId}
            onOpenEvent={setSelectedEventId}
            onOpenGoogleEvent={(ge) => {
              if (ge.htmlLink) window.open(ge.htmlLink, "_blank");
            }}
            onAddEvent={openAddEvent}
          />
        )}
        {tab === "scan" && (
          <ScanView
            docs={docs}
            isFirstScan={!tooltipsSeen.has("first_scan_done")}
            onScanned={setPendingResult}
            onOpenDoc={setSelectedId}
          />
        )}
        {tab === "templates" && (
          <TemplatesView onPick={openTemplateForm} />
        )}
        {tab === "categories" && (
          <CategoriesView
            docs={docs}
            onOpenCategory={openCategory}
            onNav={navigate}
          />
        )}
        {tab === "contacts" && (
          <ContactsView
            contacts={contacts}
            onAdd={openAddContact}
            onOpenDetail={setSelectedContactId}
          />
        )}
        {tab === "archive" && (
          <ArchiveView
            docs={docs}
            categoryFilter={categoryFilter}
            onClearCategoryFilter={() => setCategoryFilter(null)}
            onOpenDoc={setSelectedId}
            existingCategories={existingCategories}
            onUpdateCategory={updateDocCategory}
          />
        )}
        {tab === "settings" && (
          <SettingsView
            folders={fileIndex.folders}
            folderStatus={folderStatus}
            indexing={indexing}
            themeChoice={themeChoice}
            onSetTheme={setThemeChoice}
            onAddFolder={addFolder}
            onRemoveFolder={removeFolder}
            onRefreshFolder={refreshFolder}
            userEmail={userEmail}
            onUpdateEmail={updateUserEmail}
            notifPerm={notifPerm}
            onRequestNotif={requestNotifPermission}
            onExportData={exportAllData}
            onDeleteAll={deleteAllData}
            googleConnected={googleConnected}
            googleBusy={googleBusy}
            googleAutoExport={googleAutoExport}
            googleShowCalendar={googleShowCalendar}
            onGoogleConnect={connectGoogle}
            onGoogleDisconnect={disconnectGoogle}
            onSetGoogleAutoExport={setGoogleAutoExport}
            onSetGoogleShowCalendar={setGoogleShowCalendar}
            onExportCalendar={exportCalendarICS}
          />
        )}
      </main>
      <BottomNav active={tab} onChange={navigate} badges={navBadges} />

      {selectedDoc && !deadlineEditDocId && (
        <DocumentModal
          doc={selectedDoc}
          existingCategories={existingCategories}
          onClose={() => setSelectedId(null)}
          onToggleStatus={() => toggleStatus(selectedDoc.id)}
          onEditDeadline={() => openDeadlineEdit(selectedDoc.id)}
          onDelete={() => deleteDoc(selectedDoc.id)}
          onExportToCalendar={() => exportDocToICS(selectedDoc)}
          onUpdateCategory={updateDocCategory}
        />
      )}

      {deadlineEditDocId && (() => {
        const d = docs.find((x) => x.id === deadlineEditDocId);
        if (!d) return null;
        return (
          <DeadlineEditModal
            doc={d}
            onCancel={() => setDeadlineEditDocId(null)}
            onSave={saveDeadlineEdit}
          />
        );
      })()}

      {manualDeadlineFormOpen && (
        <ManualDeadlineFormModal
          googleConnected={googleConnected}
          googleAutoExport={googleAutoExport}
          onCancel={() => setManualDeadlineFormOpen(false)}
          onSave={saveManualDeadline}
        />
      )}

      {selectedReminderId && !reminderFormOpen && (() => {
        const r = reminders.find((x) => x.id === selectedReminderId);
        if (!r) return null;
        const linkedDoc = r.docId ? docs.find((x) => x.id === r.docId) : null;
        return (
          <ReminderDetailModal
            reminder={r}
            doc={linkedDoc}
            onClose={() => setSelectedReminderId(null)}
            onEdit={openEditReminder}
            onDelete={deleteReminder}
            onToggleDone={toggleSelectedReminderDone}
            onExportToCalendar={() => exportReminderToICS(r)}
            onOpenDoc={(id) => {
              setSelectedReminderId(null);
              setSelectedId(id);
            }}
          />
        );
      })()}

      {reminderFormOpen && (
        <ReminderFormModal
          initial={
            reminderFormMode === "edit"
              ? reminders.find((r) => r.id === selectedReminderId)
              : reminderFormPrefill
          }
          docs={docs}
          googleConnected={googleConnected}
          googleAutoExport={googleAutoExport}
          onCancel={closeReminderForm}
          onSave={saveReminder}
        />
      )}

      {appealDocId && (() => {
        const d = docs.find((x) => x.id === appealDocId);
        if (!d) return null;
        return (
          <AppealModal
            doc={d}
            apiBase={API_BASE}
            onClose={() => setAppealDocId(null)}
            onScheduleReminder={handleAppealScheduleReminder}
            onShowReplyDraft={handleAppealShowReplyDraft}
          />
        );
      })()}

      {selectedEventId && !eventFormOpen && (() => {
        const e = events.find((x) => x.id === selectedEventId);
        if (!e) return null;
        const c = e.contactId ? contacts.find((x) => x.id === e.contactId) : null;
        return (
          <EventDetailModal
            event={e}
            contact={c}
            onClose={() => setSelectedEventId(null)}
            onEdit={openEditEvent}
            onDelete={deleteEvent}
            onExportToCalendar={() => exportEventToICS(e)}
          />
        );
      })()}

      {eventFormOpen && (
        <EventFormModal
          initial={
            eventFormMode === "edit"
              ? events.find((e) => e.id === selectedEventId)
              : eventFormPrefill
          }
          contacts={contacts}
          googleConnected={googleConnected}
          googleAutoExport={googleAutoExport}
          onCancel={closeEventForm}
          onSave={saveEvent}
        />
      )}

      {selectedContactId && !contactFormOpen && (() => {
        const c = contacts.find((x) => x.id === selectedContactId);
        if (!c) return null;
        return (
          <ContactDetailModal
            contact={c}
            docs={docs}
            onClose={() => setSelectedContactId(null)}
            onEdit={() => {
              setContactFormMode("edit");
              setContactFormOpen(true);
            }}
            onDelete={deleteContact}
          />
        );
      })()}

      {contactFormOpen && (
        <ContactFormModal
          initial={
            contactFormMode === "edit"
              ? contacts.find((c) => c.id === selectedContactId)
              : contactFormPrefill
          }
          onCancel={closeContactForm}
          onSave={saveContact}
        />
      )}

      {pendingResult && !contactFormOpen && (
        <PostScanModal
          result={pendingResult}
          isFirstScan={!tooltipsSeen.has("first_scan_done")}
          existingCategories={existingCategories}
          onConfirm={handlePostScanConfirm}
          onSkip={handlePostScanSkip}
        />
      )}

      {templateFormType && (
        <TemplateFormModal
          templateType={templateFormType}
          contacts={contacts}
          docs={docs}
          defaultSenderName={userName}
          onSubmit={submitTemplateRequest}
          onCancel={() => setTemplateFormType(null)}
        />
      )}

      {templateResult && (
        <TemplateResultModal
          result={templateResult}
          onClose={() => setTemplateResult(null)}
          onPrint={() => window.print()}
          onSaveAsDoc={saveTemplateAsDoc}
        />
      )}

      {searchOpen && (
        <SearchModal
          docs={docs}
          contacts={contacts}
          reminders={reminders}
          events={events}
          fileIndex={fileIndex}
          showTip={!tooltipsSeen.has("search")}
          onDismissTip={() => markTooltipSeen("search")}
          onClose={() => setSearchOpen(false)}
          onOpenDoc={setSelectedId}
          onOpenContact={setSelectedContactId}
          onOpenReminder={setSelectedReminderId}
          onOpenEvent={setSelectedEventId}
          onOpenLocalFile={openLocalFile}
        />
      )}

      {disclaimerOpen && (
        <DisclaimerModal onAcknowledge={acknowledgeDisclaimer} />
      )}

      {migrationPrompt && (
        <MigrationPromptModal
          counts={migrationPrompt.counts}
          busy={migrationBusy}
          onConfirm={migrateLegacyData}
          onSkip={skipMigration}
        />
      )}

      {installPromptEvent && !installDismissed && (
        <div className="install-banner" role="dialog" aria-labelledby="install-title">
          <div className="install-banner-body">
            <div className="install-banner-title" id="install-title">
              Büro auf dem Homescreen
            </div>
            <div className="install-banner-sub">
              Installier Büro als App — schneller Zugriff ohne Browser-Tab.
            </div>
          </div>
          <div className="install-banner-actions">
            <button
              type="button"
              className="btn-secondary btn-primary-sm"
              onClick={dismissInstallBanner}
            >
              Später
            </button>
            <button
              type="button"
              className="btn-primary btn-primary-sm"
              onClick={handleInstallClick}
            >
              Installieren
            </button>
          </div>
        </div>
      )}

      {successToast && (
        <SuccessToast
          message={successToast}
          onDone={() => setSuccessToast(null)}
        />
      )}

      {syncError && (
        <div className="sync-error-toast" role="alert">
          <div className="sync-error-body">
            <strong>Sync-Fehler ({syncError.table})</strong>
            <div>{syncError.message}</div>
            {syncError.hint && (
              <div className="sync-error-hint">{syncError.hint}</div>
            )}
          </div>
          <button
            type="button"
            className="sync-error-close"
            onClick={() => setSyncError(null)}
            aria-label="Schließen"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
