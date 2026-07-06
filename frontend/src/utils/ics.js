import { isoLocal } from "./format.js";

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
