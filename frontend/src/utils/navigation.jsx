import {
  IconHome,
  IconCalendar,
  IconScan,
  IconGrid,
  IconContacts,
  IconSettings,
} from "../components/icons.jsx";
import { GOOGLE_COMING_SOON } from "./google.js";

export const NAV_ITEMS = [
  { id: "home", label: "Home", Icon: IconHome },
  { id: "calendar", label: "Kalender", Icon: IconCalendar },
  { id: "scan", label: "Scan", Icon: IconScan },
  { id: "categories", label: "Kategorien", Icon: IconGrid },
  { id: "contacts", label: "Kontakte", Icon: IconContacts },
  { id: "settings", label: "Einstellungen", Icon: IconSettings },
];

export const TAB_TIPS = {
  home: "Deine Kommandozentrale — Fristen, Ausgaben und Erinnerungen auf einen Blick.",
  calendar: GOOGLE_COMING_SOON
    ? "Fristen, Erinnerungen und Termine im Überblick — exportierbar als .ics in jede Kalender-App."
    : "Verbinde Google Calendar in den Einstellungen, um deine Termine automatisch zu synchronisieren.",
  scan: "Lade einen Brief oder eine Rechnung hoch — Büro erkennt automatisch Fristen und schlägt Aktionen vor. Vorlagen für eigene Anschreiben findest du direkt darunter.",
  categories: "Deine Post nach Absender-Typ gruppiert. Klick öffnet das gefilterte Archiv.",
  contacts:
    "Speichere Behörden, Banken und Vermieter mit IBAN und Adresse — verknüpft automatisch mit deinen Dokumenten.",
  archive: "Alle Dokumente durchsuchen und filtern. Auch erledigte bleiben hier auffindbar.",
  settings: GOOGLE_COMING_SOON
    ? "Gib Ordner frei, exportiere deinen Kalender und passe Büro an deine Bedürfnisse an."
    : "Verbinde Google Calendar, gib Ordner frei und passe Büro an deine Bedürfnisse an.",
};
