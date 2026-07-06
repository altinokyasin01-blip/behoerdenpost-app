import {
  IconHome,
  IconCalendar,
  IconScan,
  IconTemplate,
  IconGrid,
  IconContacts,
  IconArchive,
  IconSettings,
} from "../components/icons.jsx";

export const NAV_ITEMS = [
  { id: "home", label: "Home", Icon: IconHome },
  { id: "calendar", label: "Kalender", Icon: IconCalendar },
  { id: "scan", label: "Scan", Icon: IconScan },
  { id: "templates", label: "Vorlagen", Icon: IconTemplate },
  { id: "categories", label: "Kategorien", Icon: IconGrid },
  { id: "contacts", label: "Kontakte", Icon: IconContacts },
  { id: "archive", label: "Archiv", Icon: IconArchive },
  { id: "settings", label: "Einstellungen", Icon: IconSettings },
];

export const TAB_TIPS = {
  home: "Deine Kommandozentrale — Fristen, Ausgaben und Erinnerungen auf einen Blick.",
  calendar:
    "Verbinde Google Calendar in den Einstellungen, um deine Termine automatisch zu synchronisieren.",
  scan: "Lade einen Brief oder eine Rechnung hoch — Büro erkennt automatisch Fristen und schlägt Aktionen vor.",
  templates:
    "Häufige Anschreiben in Sekunden — Kündigung, Widerspruch, Datenschutzauskunft und mehr.",
  categories: "Deine Post nach Absender-Typ gruppiert. Klick öffnet das gefilterte Archiv.",
  contacts:
    "Speichere Behörden, Banken und Vermieter mit IBAN und Adresse — verknüpft automatisch mit deinen Dokumenten.",
  archive: "Alle Dokumente durchsuchen und filtern. Auch erledigte bleiben hier auffindbar.",
  settings:
    "Verbinde Google Calendar, gib Ordner frei und passe Büro an deine Bedürfnisse an.",
};
