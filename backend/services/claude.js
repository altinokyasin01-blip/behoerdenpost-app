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

const SYSTEM_PROMPT = `Du bist ein Assistent zur Analyse deutscher Behördenpost.
Analysiere das übermittelte Dokument und antworte AUSSCHLIESSLICH mit einem
JSON-Objekt in exakt diesem Schema (keine Markdown-Codeblöcke, kein Fließtext):

{
  "documentType": "Kurzbezeichnung des Dokumenttyps (z.B. Bußgeldbescheid, Steuerbescheid, Mahnung)",
  "category": "Genau EINER dieser Werte: ${ALLOWED_CATEGORIES.join(", ")}",
  "sender": "Name des Absenders/der Behörde (z.B. 'Finanzamt München-Mitte'), oder null wenn unklar",
  "amount": "Wichtigster Geldbetrag als Zahl in Euro (z.B. 230.00) oder null wenn keiner erkennbar. Nur Zahl, kein Währungssymbol, Punkt als Dezimaltrennzeichen.",
  "summary": "2-4 Sätze verständliche Zusammenfassung in einfacher Sprache",
  "deadline": "Wichtigste Frist im Format YYYY-MM-DD oder null wenn keine erkennbar",
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

Regeln für "actions":
- Mindestens 1, maximal 6 Einträge — sortiert nach priority (high zuerst).
- Entscheide selbst, welche Aktionen für dieses konkrete Dokument sinnvoll sind.
- Erlaubte type-Werte und ihre value-Semantik:
  * "contact"   — value = Name der anzulegenden/zu verknüpfenden Kontaktperson/Organisation
  * "reminder"  — value = ISO-Datum (YYYY-MM-DD), an dem erinnert werden soll
  * "amount"    — value = Zahl in Euro (Punkt als Dezimaltrennzeichen, kein Währungssymbol)
  * "deadline"  — value = ISO-Datum der Frist (YYYY-MM-DD)
  * "note"      — value = kurzer Freitext, den der Nutzer als Notiz speichern könnte
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
  return {
    documentType: parsed.documentType ?? null,
    category,
    sender: parsed.sender ?? null,
    amount,
    summary: parsed.summary ?? null,
    deadline: parsed.deadline ?? null,
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
]);
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

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
    cleaned.push({ type: item.type, label, value: value ?? null, priority });
    if (cleaned.length >= 6) break;
  }
  cleaned.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  return cleaned;
}

module.exports = { analyzeDocument };
