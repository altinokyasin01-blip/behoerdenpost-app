const Anthropic = require("@anthropic-ai/sdk");

const MODEL = "claude-sonnet-4-6";

const ALLOWED_DEADLINE_TYPES = [
  "zahlung",
  "antwort",
  "widerspruch",
  "abgabe",
  "sonstiges",
];

const FULLTEXT_SEPARATOR = "---FULLTEXT---";

const SYSTEM_PROMPT = `Du bist ein Assistent zur Analyse deutscher amtlicher
und geschäftlicher Post (Bescheide, Rechnungen, Verträge, Mahnungen).

Deine Antwort besteht aus GENAU DREI Teilen in dieser Reihenfolge:

TEIL 1 — JSON-Objekt (gültiges JSON gemäß Schema unten).
  Regeln: Strings in " " ; interne Zeilenumbrüche als \\n ; interne
  Anführungszeichen als \\" ; Backslashes als \\\\ . Keine Markdown-Code-Blöcke,
  kein Fließtext davor oder danach. Muss mit { beginnen und mit } enden.

TEIL 2 — die Trennzeile (auf einer eigenen Zeile, exakt so):
${FULLTEXT_SEPARATOR}

TEIL 3 — der Volltext des Dokuments als ROHER TEXT (KEIN JSON).
  Hier gelten KEINE Escaping-Regeln. Erlaubt und erwünscht sind:
  echte Zeilenumbrüche, Anführungszeichen "...", Backslashes \\,
  Sonderzeichen § € %, Umlaute, Klammern () {} [], alles. Extrahiere
  den Text wortgetreu wie im Dokument. Absätze durch Leerzeilen trennen.
  Priorisiere Aktenzeichen, Absender+Empfänger-Adressen, Beträge, Datums-
  angaben, Namen, IBAN/Kontonummern, Rechtsbelehrungen, Fristen. Maximal
  3000 Zeichen. Wenn kein Text im Dokument erkennbar ist, lass Teil 3 leer.

BEISPIEL für die Struktur (nicht Inhalt, nur Format):

{"documentType":"Mahnung","category":"Sonstiges","sender":"Beispiel GmbH","amount":50.00,"summary":"Kurze Zusammenfassung.","deadline":null,"deadlineType":null,"replyDraft":null,"actions":[]}
${FULLTEXT_SEPARATOR}
Beispiel GmbH
Musterstraße 1
12345 Berlin

Kundennummer: 4711
Aktenzeichen: ABC-2024/001

Sehr geehrte Frau Muster,

hiermit möchten wir Sie an die noch offene...

JSON-Schema (Teil 1):

{
  "documentType": "Kurzbezeichnung des Dokumenttyps (z.B. Bußgeldbescheid, Steuerbescheid, Mahnung)",
  "category": "Präzise, kurze Kategorie die den Absender/Kontext am besten beschreibt. Beispiele: Finanzamt, Krankenkasse, Universität, Arbeitgeber, Vermieter, Inkasso, Versicherung, Bank. Du bist nicht auf diese beschränkt — wähle was am besten passt. Niemals 'Sonstiges' wenn der Absender klar erkennbar ist. Nur wenn wirklich unklar, dann null.",
  "sender": "Name des Absenders/der Behörde (z.B. 'Finanzamt München-Mitte'), oder null wenn unklar",
  "amount": "Wichtigster Geldbetrag als Zahl in Euro (z.B. 230.00) oder null wenn keiner erkennbar. Nur Zahl, kein Währungssymbol, Punkt als Dezimaltrennzeichen.",
  "summary": "2-4 Sätze verständliche Zusammenfassung in einfacher Sprache",
  "deadline": "Wichtigste Frist im Format YYYY-MM-DD oder null wenn keine erkennbar",
  "deadlineType": "Genau EINER dieser Werte oder null wenn keine Frist: ${ALLOWED_DEADLINE_TYPES.join(", ")}",
  "recurring": "true wenn das Dokument auf eine wiederkehrende/monatliche Zahlung hindeutet (Signalwörter: Folgelastschrift, Dauerauftrag, Abo, monatlich, Mandatsreferenz, SEPA-Lastschrift mit wiederkehrendem Muster), sonst false. Reine Vermutung ist ok — der Nutzer sieht das als vorausgefüllte, änderbare Checkbox.",
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

Ordne den deadlineType nach Art der Frist zu:
- zahlung: Zahlungsfrist (Rechnung, Bußgeld, Mahnung, Steuernachzahlung)
- antwort: Frist für Rückmeldung/Stellungnahme/Nachweisvorlage
- widerspruch: Widerspruchs-/Einspruchsfrist gegen Bescheid
- abgabe: Abgabefrist (Steuererklärung, Antragsformular, Nachweis)
- sonstiges: alle anderen Fristen, wenn Kategorie unklar

Das gilt genauso für wiederkehrende/monatliche Rechnungen (Abo, Mobilfunk,
Strom, Miete u.ä.) — nicht nur für einmalige Bescheide. Suche nach
Formulierungen wie "zahlbar bis", "fällig am", "Fälligkeitsdatum" oder dem
Termin des Lastschrifteinzugs und setze dieses Datum als "deadline" mit
deadlineType "zahlung", auch wenn sich die Rechnung monatlich wiederholt.

Regeln für "actions":
- Mindestens 1, maximal 6 Einträge — sortiert nach priority (high zuerst).
- Entscheide selbst, welche Aktionen für dieses konkrete Dokument sinnvoll sind.
- Erlaubte type-Werte und ihre value-Semantik:
  * "contact"   — value = Objekt {
                     "name": "Nur der Name der Organisation/Person — KEINE E-Mail-Adresse, KEINE Postadresse, KEIN Freitext. Reiner Name.",
                     "type": "Behörde | Bank | Vermieter | Arbeitgeber | Universität | Arzt | Versicherung | Sonstiges",
                     "email": "E-Mail falls im Dokument erkennbar",
                     "phone": "Telefonnummer falls erkennbar",
                     "street": "Straße + Hausnummer falls erkennbar",
                     "zip": "Postleitzahl falls erkennbar",
                     "city": "Stadt/Ort falls erkennbar",
                     "iban": "IBAN des Kontakts, falls erkennbar. Kann unter verschiedenen Bezeichnungen im Dokument stehen (z.B. Empfänger-IBAN, Zahlungsempfänger, Kontoinhaber, Gegenkonto, IBAN im Briefkopf). Ordne sie dem Kontakt zu, wenn erkennbar ist, dass es sich um dessen Bankverbindung handelt.",
                     "bic": "BIC/SWIFT-Code des Kontakts, falls erkennbar — analog zu iban.",
                     "website": "URL falls erkennbar",
                     "notes": "Weitere relevante Infos die nicht in andere Felder passen: Ansprechpartner, Abteilung, Öffnungszeiten, Aktenzeichen, Kundennummer, USt-ID, Handelsregister etc."
                   }
                 Felder ohne erkennbaren Wert einfach weglassen. Der "name" ist Pflicht.
                 street/zip/city bilden zusammen eine vollständige Postadresse — erkenne
                 sie als Einheit aus dem Absenderblock oder einer Adressangabe im Dokument,
                 nicht nur die Straße. Wenn PLZ und Ort im Dokument stehen (auch wenn sie in
                 einer eigenen Zeile stehen), gib beide mit an statt nur "street" zu füllen.
                 Erfinde aber nichts — wenn PLZ oder Ort im Dokument nicht vorkommen, lass
                 die Felder leer.
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
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          buildContentBlock(base64, mimeType),
          {
            type: "text",
            text: `Analysiere dieses Dokument. Antworte im vorgegebenen Format: JSON, dann Zeile "${FULLTEXT_SEPARATOR}", dann der Volltext.`,
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

  const { jsonPart, fullText: rawFullText } = splitFullText(text);

  const jsonStart = jsonPart.indexOf("{");
  const jsonEnd = jsonPart.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    console.error("Claude response missing JSON braces. First 500 chars:", text.slice(0, 500));
    throw new Error("Claude response did not contain JSON");
  }

  const jsonSlice = jsonPart.slice(jsonStart, jsonEnd + 1);
  let parsed;
  try {
    parsed = JSON.parse(jsonSlice);
  } catch (initialErr) {
    // Attempt a repair pass: escape unescaped control chars inside strings.
    console.warn(
      "Claude JSON parse failed on first pass:",
      initialErr.message,
      "— attempting repair."
    );
    try {
      parsed = JSON.parse(repairJson(jsonSlice));
      console.log("Claude JSON repair succeeded.");
    } catch (repairErr) {
      console.error(
        "Claude JSON repair failed:",
        repairErr.message,
        "\nOriginal error:",
        initialErr.message,
        "\nJSON slice (first 800 chars):",
        jsonSlice.slice(0, 800)
      );
      throw new Error(
        `Claude response was not valid JSON: ${initialErr.message}`
      );
    }
  }

  const category =
    typeof parsed.category === "string" && parsed.category.trim()
      ? parsed.category.trim()
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
  // Prefer the separator-delivered fullText (robust). Fall back to a
  // "fullText" field inside the JSON if the model ignored the format.
  let fullText = rawFullText;
  if (!fullText && typeof parsed.fullText === "string" && parsed.fullText.trim()) {
    fullText = parsed.fullText.trim();
  }
  fullText = fullText ? fullText.slice(0, 3000) : null;

  return {
    documentType: parsed.documentType ?? null,
    category,
    sender: parsed.sender ?? null,
    amount,
    summary: parsed.summary ?? null,
    fullText,
    deadline,
    deadlineType,
    recurring: parsed.recurring === true,
    replyDraft: parsed.replyDraft ?? null,
    actions: normalizeActions(parsed.actions),
  };
}

function splitFullText(text) {
  const idx = text.indexOf(FULLTEXT_SEPARATOR);
  if (idx === -1) {
    return { jsonPart: text, fullText: null };
  }
  const jsonPart = text.slice(0, idx).trim();
  const fullText = text.slice(idx + FULLTEXT_SEPARATOR.length).trim() || null;
  return { jsonPart, fullText };
}

// Escape raw control characters (unescaped newlines, tabs, carriage returns)
// that occur INSIDE JSON strings. This is the most common LLM-JSON failure
// mode. Chars outside string literals are left alone.
function repairJson(text) {
  let out = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      out += ch;
      escape = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      escape = true;
      continue;
    }
    if (ch === '"') {
      out += ch;
      inString = !inString;
      continue;
    }
    if (inString) {
      if (ch === "\n") {
        out += "\\n";
        continue;
      }
      if (ch === "\r") {
        out += "\\r";
        continue;
      }
      if (ch === "\t") {
        out += "\\t";
        continue;
      }
    }
    out += ch;
  }
  return out;
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

const ALLOWED_CONTACT_TYPES = new Set([
  "Behörde",
  "Bank",
  "Vermieter",
  "Arbeitgeber",
  "Universität",
  "Arzt",
  "Versicherung",
  "Sonstiges",
]);

function normalizeContactValue(raw) {
  // Backward compatibility: string value is treated as name
  if (typeof raw === "string") {
    const name = raw.trim();
    return name ? { name } : null;
  }
  if (!raw || typeof raw !== "object") return null;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return null;
  const out = { name };
  if (
    typeof raw.type === "string" &&
    ALLOWED_CONTACT_TYPES.has(raw.type.trim())
  ) {
    out.type = raw.type.trim();
  }
  for (const field of [
    "email",
    "phone",
    "street",
    "zip",
    "city",
    "iban",
    "bic",
    "website",
    "notes",
  ]) {
    if (typeof raw[field] === "string" && raw[field].trim()) {
      out[field] = raw[field].trim();
    }
  }
  return out;
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
    if (item.type === "contact") {
      value = normalizeContactValue(value);
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
  "category": "Kurze passende Kategorie basierend auf QR-Inhalt (z.B. 'Bank' für SEPA, 'Website' für URL). Wenn nichts passt, null.",
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
  const category =
    typeof parsed.category === "string" && parsed.category.trim()
      ? parsed.category.trim()
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
