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
  "summary": "2-4 Sätze verständliche Zusammenfassung in einfacher Sprache",
  "deadline": "Wichtigste Frist im Format YYYY-MM-DD oder null wenn keine erkennbar",
  "replyDraft": "Vorschlag für ein Antwortschreiben (Deutsch, förmlicher Ton) oder null"
}

Ordne die Kategorie nach Absender/Inhalt zu:
- Finanzamt: Steuerbescheide, Mahnungen vom Finanzamt
- Krankenkasse: Beitragsbescheide, Leistungsentscheidungen der GKV/PKV
- Vermieter: Miete, Nebenkostenabrechnung, Hausverwaltung
- Inkasso: Inkassobüros, Mahnbescheide von Gläubigern (nicht Finanzamt)
- Versicherung: KFZ-, Haftpflicht-, Rechtsschutz- etc. (nicht Krankenversicherung)
- Sonstiges: alles andere (Rente, BAföG, Behörden, GEZ, ...)`;

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
  return {
    documentType: parsed.documentType ?? null,
    category,
    summary: parsed.summary ?? null,
    deadline: parsed.deadline ?? null,
    replyDraft: parsed.replyDraft ?? null,
  };
}

module.exports = { analyzeDocument };
