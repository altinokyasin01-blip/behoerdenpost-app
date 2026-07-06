export const TODAY = new Date("2026-07-02T00:00:00");

export function isoLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso, delta) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return isoLocal(d);
}

export function todayIso() {
  return isoLocal(TODAY);
}

export function formatAmount(v) {
  if (v == null || v === "") return "";
  if (typeof v === "string") return v;
  return v.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

export function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || "");
}

export function formatBytes(n) {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function daysUntil(iso) {
  const d = new Date(iso + "T00:00:00");
  return Math.ceil((d - TODAY) / 86400000);
}

export function deadlineLevel(days) {
  if (days < 7) return "red";
  if (days < 14) return "amber";
  return "green";
}

export function progressPct(days) {
  const pct = ((30 - days) / 30) * 100;
  return Math.max(4, Math.min(100, pct));
}

export function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("de-DE");
}
