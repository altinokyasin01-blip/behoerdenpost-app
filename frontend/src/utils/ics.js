import { isoLocal } from "./format.js";

// Constructs a Date at `time` on `dateIso`. Used together with plusOneHour
// below so hour-overflow (an event starting at 23:xx) rolls over into the
// next day (and month/year, if needed) via native Date arithmetic, instead
// of manual `% 24` math that left the date component unchanged and could
// produce an end time before the start time.
function dateTimeAt(dateIso, timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(dateIso + "T00:00:00");
  d.setHours(h, m, 0, 0);
  return d;
}

function plusOneHour(date) {
  const d = new Date(date);
  d.setHours(d.getHours() + 1);
  return d;
}

export function bueroItemToGoogleEvent(item, kind) {
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
    const start = dateTimeAt(item.date, item.time);
    const end = plusOneHour(start);
    const fmt = (d) =>
      `${isoLocal(d)}T${String(d.getHours()).padStart(2, "0")}:${String(
        d.getMinutes()
      ).padStart(2, "0")}:00`;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return {
      ...base,
      start: { dateTime: fmt(start), timeZone },
      end: { dateTime: fmt(end), timeZone },
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

function icsFormatDateTime(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${icsDate(isoLocal(d))}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function icsAddDay(iso) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return isoLocal(d);
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
    const start = dateTimeAt(entry.date, entry.time);
    const end = plusOneHour(start);
    lines.push(`DTSTART:${icsFormatDateTime(start)}`);
    lines.push(`DTEND:${icsFormatDateTime(end)}`);
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

export function generateICS(entries) {
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

export function downloadICS(filename, entries) {
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

export function docToIcsEntry(doc) {
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

export function reminderToIcsEntry(reminder) {
  return {
    kind: "reminder",
    id: reminder.id,
    title: reminder.title,
    date: reminder.date,
    notes: reminder.notes,
  };
}

export function eventToIcsEntry(event) {
  return {
    kind: "event",
    id: event.id,
    title: event.title,
    date: event.date,
    time: event.time,
    notes: event.notes,
  };
}
