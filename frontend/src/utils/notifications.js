import { TODAY, isoLocal, daysUntil } from "./format.js";

export function sendDeadlineReminders(docs, reminders = []) {
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
