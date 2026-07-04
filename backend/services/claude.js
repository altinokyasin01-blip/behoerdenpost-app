const Anthropic = require("@anthropic-ai/sdk");

const MODEL = "claude-sonnet-4-6";

const ALLOWED_CATEGORIES = [
  "Finanzamt",
  "Krankenkasse",
  "Vermieter",
  "Inkasso",
  "Versicherung",
  "Sonstiges",
];

const ALLOWED_DEADLINE_TYPES = [
  "zahlung",
  "antwort",
  "widerspruch",
  "abgabe",
  "sonstiges",
];

const SYSTEM_PROMPT = `Du bist ein Assistent zur Analyse deutscher amtlicher
und geschäftlicher Post (Bescheide, Rechnungen, Verträge, Mahnungen).
Analysiere das übermittelte Dokument und antworte AUSSCHLIESSLICH mit einem
JSON-Objekt in exakt diesem Schema (keine Markdown-Codeblöcke, kein Fließtext):

{
  "documentType": "Kurzbezeichnung des Dokumenttyps (z.B. Bußgeldbescheid, Steuerbescheid, Mahnung)",
  "category": "Genau EINER dieser Werte: ${ALLOWED_CATEGORIES.join(", ")}",
  "sender": "Name des Absenders/der Behörde (z.B. 'Finanzamt München-Mitte'), oder null wenn unklar",
  "amount": "Wichtigster Geldbetrag als Zahl in Euro (z.B. 230.00) oder null wenn keiner erkennbar. Nur Zahl, kein Währungssymbol, Punkt als Dezimaltrennzeichen.",
  "summary": "2-4 Sätze verständliche Zusammenfassung in einfacher Sprache",
  "deadline": "Wichtigste Frist im Format YYYY-MM-DD oder null wenn keine erkennbar",
  "deadlineType": "Genau EINER dieser Werte oder null wenn keine Frist: ${ALLOWED_DEADLINE_TYPES.join(", ")}",
  "replyDraft": "Vorschlag für ein Antwortschreiben (Deutsch, förmlicher Ton) oder null",
  "actions": [
    {
      "type": "contact | reminder | amount | deadline | note",
      "label": "Kurze Beschreibung für den Nutzer (z.B. 'Kontakt anlegen: Finanzamt München-Mitte')",
      "value": "Der konkrete Wert (Kontaktname, ISO-Datum YYYY-MM-DD, Betrag als Zahl, Notiztext)",
      "priority": "high | medium | low"
    }
  ]
}

Ordne die Kategorie nach Absender/Inhalt zu:
- Finanzamt: Steuerbescheide, Mahnungen vom Finanzamt
- Krankenkasse: Beitragsbescheide, Leistungsentscheidungen der GKV/PKV
- Vermieter: Miete, Nebenkostenabrechnung, Hausverwaltung
- Inkasso: Inkassobüros, Mahnbescheide von Gläubigern (nicht Finanzamt)
- Versicherung: KFZ-, Haftpflicht-, Rechtsschutz- etc. (nicht Krankenversicherung)
- Sonstiges: alles andere (Rente, BAföG, Behörden, GEZ, ...)

Ordne den deadlineType nach Art der Frist zu:
- zahlung: Zahlungsfrist (Rechnung, Bußgeld, Mahnung, Steuernachzahlung)
- antwort: Frist für Rückmeldung/Stellungnahme/Nachweisvorlage
- widerspruch: Widerspruchs-/Einspruchsfrist gegen Bescheid
- abgabe: Abgabefrist (Steuererklärung, Antragsformular, Nachweis)
- sonstiges: alle anderen Fristen, wenn Kategorie unklar

Regeln für "actions":
- Mindestens 1, maximal 6 Einträge — sortiert nach priority (high zuerst).
- Entscheide selbst, welche Aktionen für dieses konkrete Dokument sinnvoll sind.
- Erlaubte type-Werte und ihre value-Semantik:
  * "contact"   — value = Name der anzulegenden/zu verknüpfenden Kontaktperson/Organisation
  * "reminder"  — value = ISO-Datum (YYYY-MM-DD), an dem erinnert werden soll
  * "amount"    — value = Zahl in Euro (Punkt als Dezimaltrennzeichen, kein Währungssymbol)
  * "deadline"  — value = ISO-Datum der Frist (YYYY-MM-DD)
  * "note"      — value = kurzer Freitext, den der Nutzer als Notiz speichern könnte
  * "event"     — value = Objekt { "title": "Kurzer Termintitel",
                                   "date": "YYYY-MM-DD",
                                   "time": "HH:MM" oder null,
                                   "notes": "Optional: Ort/Aktenzeichen/Hinweis oder null" }
                 Verwende "event" NUR bei konkreten Terminen mit Ort und/oder Uhrzeit
                 (Gerichtstermin, Anhörung, Vorladung, Vor-Ort-Prüfung, Abgabe-Termin
                 mit Erscheinungspflicht). Kein "event" für reine Deadlines — dafür
                 gibt es "deadline" und "reminder".
- priority:
  * "high"   — dringend / rechtsverbindlich / vor Ablauf einer nahen Frist relevant
  * "medium" — hilfreich, aber nicht zeitkritisch
  * "low"    — Bonus / optional
- label ist ein imperativer Vorschlag ("Kontakt anlegen: …", "Erinnerung: 3 Tage vor Frist", "Betrag notieren: 230 €", "Notiz speichern: …").
- Gib den label-Text auf Deutsch aus.
- Wenn deadline im Hauptobjekt gesetzt ist, sollte typischerweise auch eine
  "deadline"-action mit demselben Datum in der Liste stehen (damit der Nutzer die
  Übernahme in einer Übersicht bestätigen kann).`;

let client = null;
function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

function buildContentBlock(base64, mimeType) {
  if (mimeType === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: base64 },
    };
  }
  return {
    type: "image",
    source: { type: "base64", media_type: mimeType, data: base64 },
  };
}

async function analyzeDocument(base64, mimeType) {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          buildContentBlock(base64, mimeType),
          {
            type: "text",
            text: "Analysiere dieses Behördendokument und liefere die JSON-Antwort gemäß Schema.",
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("Claude response did not contain JSON");
  }

  const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  const category = ALLOWED_CATEGORIES.includes(parsed.category)
    ? parsed.category
    : "Sonstiges";
  const amount =
    typeof parsed.amount === "number" && !Number.isNaN(parsed.amount)
      ? parsed.amount
      : null;
  const deadline = parsed.deadline ?? null;
  const deadlineType = deadline
    ? (ALLOWED_DEADLINE_TYPES.includes(parsed.deadlineType)
        ? parsed.deadlineType
        : "sonstiges")
    : null;
  return {
    documentType: parsed.documentType ?? null,
    category,
    sender: parsed.sender ?? null,
    amount,
    summary: parsed.summary ?? null,
    deadline,
    deadlineType,
    replyDraft: parsed.replyDraft ?? null,
    actions: normalizeActions(parsed.actions),
  };
}

const ACTION_TYPES = new Set([
  "contact",
  "reminder",
  "amount",
  "deadline",
  "note",
  "event",
]);
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_RE = /^\d{2}:\d{2}$/;

function normalizeEventValue(raw) {
  if (!raw || typeof raw !== "object") return null;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const date = typeof raw.date === "string" && ISO_DATE_RE.test(raw.date)
    ? raw.date
    : null;
  if (!title || !date) return null;
  const time = typeof raw.time === "string" && HHMM_RE.test(raw.time)
    ? raw.time
    : null;
  const notes = typeof raw.notes === "string" && raw.notes.trim()
    ? raw.notes.trim()
    : null;
  return { title, date, time, notes };
}

function normalizeActions(raw) {
  if (!Array.isArray(raw)) return [];
  const cleaned = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    if (!ACTION_TYPES.has(item.type)) continue;
    const label = typeof item.label === "string" ? item.label.trim() : "";
    if (!label) continue;
    const priority = PRIORITY_RANK[item.priority] != null ? item.priority : "medium";
    let value = item.value;
    if (item.type === "amount" && typeof value === "string") {
      const n = Number(value.replace(",", "."));
      value = Number.isFinite(n) ? n : null;
    }
    if (item.type === "event") {
      value = normalizeEventValue(value);
      if (!value) continue;
    }
    cleaned.push({ type: item.type, label, value: value ?? null, priority });
    if (cleaned.length >= 6) break;
  }
  cleaned.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  return cleaned;
}

const APPEAL_CHANCES = ["hoch", "mittel", "gering", "keine"];

const APPEAL_SYSTEM_PROMPT = `Du beurteilst kurz und ehrlich die Erfolgsaussicht eines
Widerspruchs gegen einen deutschen Behördenbescheid — basierend auf den
Metadaten, die dir übergeben werden. Antworte AUSSCHLIESSLICH mit einem
JSON-Objekt (keine Codeblöcke, kein Fließtext davor/danach):

{
  "worthwhile": true | false,
  "reasoning": "2-3 Sätze auf Deutsch, warum ein Widerspruch sinnvoll oder wenig aussichtsreich ist. Einfache Sprache, keine Aufzählung.",
  "successChance": "hoch | mittel | gering | keine",
  "tip": "Optional: ein konkreter Hinweis, was der Nutzer beilegen oder erwähnen sollte. null, wenn kein guter Tipp einfällt."
}

Regeln:
- Sei realistisch, nicht ermutigend um jeden Preis.
- worthwhile=false, wenn successChance "gering" oder "keine" ist.
- reasoning bezieht sich auf typische Fälle dieses Dokumenttyps — nicht auf
  konkrete Beweismittel, die du nicht kennst.
- Kein Rechtsrat, keine Paragraphen. Kein Disclaimer im Text — der wird
  im Frontend ergänzt.`;

async function analyzeAppeal({ documentType, summary, deadlineType }) {
  const context = [
    documentType ? `Dokumenttyp: ${documentType}` : null,
    deadlineType ? `Frist-Typ: ${deadlineType}` : null,
    summary ? `Zusammenfassung:\n${summary}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 512,
    system: APPEAL_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content:
          (context || "Keine weiteren Metadaten verfügbar.") +
          "\n\nGib jetzt die JSON-Einschätzung.",
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("Claude appeal response did not contain JSON");
  }
  const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

  const successChance = APPEAL_CHANCES.includes(parsed.successChance)
    ? parsed.successChance
    : "mittel";
  const worthwhile =
    typeof parsed.worthwhile === "boolean"
      ? parsed.worthwhile
      : successChance === "hoch" || successChance === "mittel";

  return {
    worthwhile,
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : "",
    successChance,
    tip:
      typeof parsed.tip === "string" && parsed.tip.trim()
        ? parsed.tip.trim()
        : null,
  };
}

const QR_SYSTEM_PROMPT = `Du analysierst den Textinhalt eines QR-Codes oder Barcodes.
Häufigste Fälle im deutschen Kontext: SEPA-Überweisung (EPC-QR beginnt mit "BCD\\n"),
URL (http/https), vCard (BEGIN:VCARD), WLAN-Zugang (WIFI:), reiner Text.

Antworte AUSSCHLIESSLICH mit JSON in exakt diesem Schema (keine Codeblöcke,
kein Fließtext davor/danach):

{
  "documentType": "SEPA-Überweisung | Link | Kontakt | WLAN | Text | ...",
  "category": "Genau EINER dieser Werte: ${ALLOWED_CATEGORIES.join(", ")}",
  "sender": "Bei SEPA: Zahlungsempfänger. Bei vCard: Name. Sonst null.",
  "amount": "Bei SEPA: Zahl in Euro (Punkt als Dezimaltrennzeichen). Sonst null.",
  "summary": "1-2 Sätze in einfacher Sprache, was der Nutzer damit tun kann",
  "deadline": null,
  "deadlineType": null,
  "replyDraft": null,
  "actions": [ Actions wie im Post-Scan-Flow ]
}

SEPA/EPC-Regeln:
- Header ist "BCD" gefolgt von Zeilenumbrüchen. Reihenfolge der Zeilen ab Zeile 5:
  BIC, Empfängername, IBAN, Betrag (Format "EUR230.00"), Purpose-Code, Referenz, Verwendungszweck.
- Erzeuge diese Actions:
  * "amount" mit dem Betrag als Zahl (high priority)
  * "contact" mit dem Empfängernamen (medium priority)
  * "note" mit dem Verwendungszweck (medium priority)

URL-Regeln:
- Erzeuge eine "note"-Action mit der URL im value und Label "Link öffnen: ...".

vCard-Regeln:
- Erzeuge "contact"-Action mit dem Namen als value.

WLAN-Regeln:
- Erzeuge "note"-Action mit Netzwerknamen und Passwort im value.

Text/Sonstiges:
- Erzeuge "note"-Action mit dem gescannten Text.

Erlaubte action.type-Werte und Semantik wie im normalen Doc-Analyse-Prompt:
contact | reminder | amount | deadline | note | event.
Sortierung nach priority (high | medium | low). Max 6 Einträge.`;

async function analyzeQrContent(content) {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: QR_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `QR-Inhalt:\n\n${content}\n\nAntworte mit dem JSON.`,
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("Claude QR response did not contain JSON");
  }
  const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  const category = ALLOWED_CATEGORIES.includes(parsed.category)
    ? parsed.category
    : "Sonstiges";
  const amount =
    typeof parsed.amount === "number" && !Number.isNaN(parsed.amount)
      ? parsed.amount
      : null;
  return {
    documentType: parsed.documentType ?? null,
    category,
    sender: parsed.sender ?? null,
    amount,
    summary: parsed.summary ?? null,
    deadline: null,
    deadlineType: null,
    replyDraft: null,
    qrContent: content,
    actions: normalizeActions(parsed.actions),
  };
}

const TEMPLATE_TYPES = new Set([
  "kuendigung",
  "widerspruch",
  "zahlungserinnerung",
  "nachfrage",
  "akteneinsicht",
  "beschwerde",
  "vollmacht",
  "datenschutzauskunft",
]);

const TEMPLATE_LABELS = {
  kuendigung: "Kündigung",
  widerspruch: "Widerspruch",
  zahlungserinnerung: "Zahlungserinnerung",
  nachfrage: "Nachfrage/Rückfrage",
  akteneinsicht: "Antrag auf Akteneinsicht",
  beschwerde: "Beschwerde",
  vollmacht: "Vollmacht",
  datenschutzauskunft: "Datenschutzauskunft (DSGVO Art. 15)",
};

const TEMPLATE_SYSTEM_PROMPT = `Du verfasst formelle deutsche Anschreiben.

Regeln:
- Höflicher, sachlicher Ton. "Sehr geehrte Damen und Herren," wenn kein Ansprechpartner bekannt ist.
- Kein juristischer Übereifer, aber präzise. Nenne konkrete Punkte aus dem Kontext.
- Wenn ein Referenzdokument gegeben ist, beziehe dich darauf (Aktenzeichen, Datum).
- Schluss mit "Mit freundlichen Grüßen" und dem Absendernamen (falls angegeben, sonst "[Ihr Name]").
- Kein Datumsstempel im Body (das setzt der Nutzer selbst).
- Kein Absender-/Empfängerblock (der Nutzer druckt das auf Briefpapier).
- Länge: 100-250 Wörter.

Antworte AUSSCHLIESSLICH mit JSON:
{
  "subject": "Betreff des Schreibens",
  "body": "Der Text ab Anrede. Absätze mit Leerzeilen getrennt."
}`;

async function generateTemplate({
  templateType,
  context,
  senderName,
  recipient,
  linkedDoc,
}) {
  if (!TEMPLATE_TYPES.has(templateType)) {
    throw new Error("Unknown template type");
  }
  const parts = [`Vorlagentyp: ${TEMPLATE_LABELS[templateType]}`];
  if (senderName) parts.push(`Absender: ${senderName}`);
  if (recipient) {
    const line = [recipient.name, recipient.street, [recipient.zip, recipient.city].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ");
    if (line) parts.push(`Empfänger: ${line}`);
  }
  if (linkedDoc) {
    const line = [linkedDoc.title, linkedDoc.sender, linkedDoc.date, linkedDoc.summary]
      .filter(Boolean)
      .join(" | ");
    parts.push(`Referenzdokument: ${line}`);
  }
  parts.push(`Kontext des Nutzers:\n${context || "(keiner)"}`);

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: TEMPLATE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: parts.join("\n\n") + "\n\nErzeuge jetzt das Anschreiben als JSON.",
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("Claude template response did not contain JSON");
  }
  const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  return {
    subject: typeof parsed.subject === "string" ? parsed.subject.trim() : "",
    body: typeof parsed.body === "string" ? parsed.body.trim() : "",
    templateType,
    templateLabel: TEMPLATE_LABELS[templateType],
  };
}

module.exports = {
  analyzeDocument,
  analyzeAppeal,
  analyzeQrContent,
  generateTemplate,
};
