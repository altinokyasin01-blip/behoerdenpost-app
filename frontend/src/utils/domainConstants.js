export const CONTACT_TYPES = [
  "Behörde",
  "Bank",
  "Vermieter",
  "Arbeitgeber",
  "Universität",
  "Arzt",
  "Versicherung",
  "Sonstiges",
];

export const CATEGORY_TO_CONTACT_TYPE = {
  Finanzamt: "Behörde",
  Krankenkasse: "Versicherung",
  Vermieter: "Vermieter",
  Inkasso: "Sonstiges",
  Versicherung: "Versicherung",
  Sonstiges: "Sonstiges",
};

export const DEADLINE_TYPES = ["zahlung", "antwort", "widerspruch", "abgabe", "sonstiges"];
export const DEADLINE_TYPE_LABEL = {
  zahlung: "Zahlung",
  antwort: "Antwort",
  widerspruch: "Widerspruch",
  abgabe: "Abgabe",
  sonstiges: "Sonstiges",
};

export const REMINDER_DAYS_BEFORE_OPTIONS = [0, 1, 3, 7];

const CATEGORY_SYMBOLS = {
  Finanzamt: "§",
  Krankenkasse: "+",
  Vermieter: "⌂",
  Inkasso: "!",
  Versicherung: "◆",
  Sonstiges: "…",
};

export function categorySymbol(name) {
  return CATEGORY_SYMBOLS[name] || name.charAt(0).toUpperCase();
}

export const TEMPLATE_TYPES = [
  { id: "kuendigung", label: "Kündigung", desc: "Vertrag oder Abo kündigen" },
  { id: "widerspruch", label: "Widerspruch", desc: "Bescheid oder Entscheidung widersprechen" },
  { id: "zahlungserinnerung", label: "Zahlungserinnerung", desc: "Ausstehende Rechnung anmahnen" },
  { id: "nachfrage", label: "Nachfrage", desc: "Rückfrage zu einem Vorgang" },
  { id: "akteneinsicht", label: "Akteneinsicht", desc: "Zugang zu deiner Akte fordern" },
  { id: "beschwerde", label: "Beschwerde", desc: "Formelle Beschwerde einreichen" },
  { id: "vollmacht", label: "Vollmacht", desc: "Jemanden bevollmächtigen" },
  { id: "datenschutzauskunft", label: "Datenschutzauskunft", desc: "Auskunft nach DSGVO Art. 15" },
];
