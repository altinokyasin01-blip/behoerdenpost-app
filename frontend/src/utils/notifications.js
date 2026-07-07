import { TODAY, isoLocal, daysUntil, addDays } from "./format.js";

const NOTIFIED_KEY_PREFIX = "notified_";
const NOTIFIED_MAX_AGE_DAYS = 7;

// The notified_${id}_${date} keys never expire on their own — one gets
// written per doc/reminder per day it notifies, forever. Swept once per
// call (piggybacking on sendDeadlineReminders' existing app-start-ish
// cadence) rather than adding a separate lifecycle hook.
function cleanupOldNotifiedKeys(todayIso) {
  const cutoff = addDays(todayIso, -NOTIFIED_MAX_AGE_DAYS);
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(NOTIFIED_KEY_PREFIX)) continue;
      const m = key.match(/(\d{4}-\d{2}-\d{2})$/);
      if (m && m[1] < cutoff) toRemove.push(key);
    }
    for (const key of toRemove) localStorage.removeItem(key);
  } catch {
    // ignore — same fail-soft policy as the rest of this module
  }
}

export function sendDeadlineReminders(docs, reminders = []) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  const today = isoLocal(TODAY);
  cleanupOldNotifiedKeys(today);
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
