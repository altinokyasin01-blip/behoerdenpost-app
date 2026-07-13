import { useEffect, useMemo, useRef, useState } from "react";
import API_BASE from "./config.js";
import {
  supabase,
  SUPABASE_CONFIGURED,
  fetchAll,
  syncDiff,
  bulkInsert,
} from "./supabase.js";
import "./App.css";
import { IconSearch } from "./components/icons.jsx";
import { TAB_TIPS } from "./utils/navigation.jsx";
import { APP_VERSION } from "./utils/legal.jsx";
import {
  STORAGE_KEY,
  DISCLAIMER_KEY,
  ONBOARDING_KEY,
  EMAIL_KEY,
  CONTACTS_KEY,
  REMINDERS_KEY,
  EVENTS_KEY,
  THEME_KEY,
  THEME_CHOICES,
  USER_NAME_KEY,
  TIPS_SEEN_KEY,
  INSTALL_DISMISSED_KEY,
  BROWSER_TIP_SEEN_KEY,
  TARIF_INTRO_SEEN_KEY,
  BROWSER_TIP_TEXT,
  loadBoolPref,
  loadContacts,
  loadReminders,
  loadEvents,
  loadDocs,
  loadDisclaimerOpen,
  loadOnboardingDone,
  loadUserEmail,
  loadTooltipsSeen,
} from "./utils/storage.js";
import { TODAY, isoLocal, addDays, todayIso } from "./utils/format.js";
import { senderMatchesContactName, isActive } from "./utils/insights.js";
import { authFetch } from "./utils/apiFetch.js";
import {
  CONTACT_TYPES,
  CATEGORY_TO_CONTACT_TYPE,
  DEADLINE_TYPES,
  TEMPLATE_TYPES,
} from "./utils/domainConstants.js";
import {
  googleSignIn,
  googleRevoke,
  googleCreateEvent,
  googleListEvents,
  loadGoogleToken,
  GOOGLE_CONFIGURED,
  GOOGLE_COMING_SOON,
  GOOGLE_TOKEN_KEY,
  GOOGLE_AUTO_EXPORT_KEY,
  GOOGLE_SHOW_CALENDAR_KEY,
} from "./utils/google.js";
import {
  bueroItemToGoogleEvent,
  downloadICS,
  docToIcsEntry,
  reminderToIcsEntry,
  eventToIcsEntry,
} from "./utils/ics.js";
import { sendDeadlineReminders } from "./utils/notifications.js";
import {
  FS_SUPPORTED,
  idbGetAll,
  idbPut,
  idbDelete,
  indexFolderFully,
  syncFolderIncremental,
  resolveFileFromHandle,
  loadFileIndex,
  FILE_INDEX_KEY,
  IDB_NAME,
} from "./utils/fileIndex.js";
import TabTip from "./components/TabTip.jsx";
import SuccessToast from "./components/SuccessToast.jsx";
import Sidebar from "./components/Sidebar.jsx";
import BottomNav from "./components/BottomNav.jsx";
import HomeView from "./views/HomeView.jsx";
import CalendarView from "./views/CalendarView.jsx";
import ScanView from "./views/ScanView.jsx";
import CategoriesView from "./views/CategoriesView.jsx";
import ArchiveView from "./views/ArchiveView.jsx";
import ContactsView from "./views/ContactsView.jsx";
import SettingsView from "./views/SettingsView.jsx";
import DocumentModal from "./modals/DocumentModal.jsx";
import PostScanModal from "./modals/PostScanModal.jsx";
import DeadlineEditModal from "./modals/DeadlineEditModal.jsx";
import ManualDeadlineFormModal from "./modals/ManualDeadlineFormModal.jsx";
import ReminderFormModal from "./modals/ReminderFormModal.jsx";
import ReminderDetailModal from "./modals/ReminderDetailModal.jsx";
import AppealModal from "./modals/AppealModal.jsx";
import EventFormModal from "./modals/EventFormModal.jsx";
import EventDetailModal from "./modals/EventDetailModal.jsx";
import SearchModal from "./modals/SearchModal.jsx";
import TemplateFormModal from "./modals/TemplateFormModal.jsx";
import TemplateResultModal from "./modals/TemplateResultModal.jsx";
import DisclaimerModal from "./modals/DisclaimerModal.jsx";
import TarifOnboardingModal from "./modals/TarifOnboardingModal.jsx";
import UpsellModal from "./modals/UpsellModal.jsx";
import AuthConfigMissingScreen from "./modals/AuthConfigMissingScreen.jsx";
import MigrationPromptModal from "./modals/MigrationPromptModal.jsx";
import OnboardingScreen from "./modals/OnboardingScreen.jsx";
import ContactFormModal from "./modals/ContactFormModal.jsx";
import ContactDetailModal from "./modals/ContactDetailModal.jsx";

export default function App() {
  const [tab, setTab] = useState("home");
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [migrationPrompt, setMigrationPrompt] = useState(null);
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [docs, setDocs] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [events, setEvents] = useState([]);
  const [savedTemplates, setSavedTemplates] = useState([]);
  const docsPrevRef = useRef([]);
  const contactsPrevRef = useRef([]);
  const remindersPrevRef = useRef([]);
  const eventsPrevRef = useRef([]);
  const savedTemplatesPrevRef = useRef([]);
  const syncChainRef = useRef(Promise.resolve());
  const [pendingResult, setPendingResult] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [scanCategoryPrefill, setScanCategoryPrefill] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [contactFormMode, setContactFormMode] = useState("add");
  const [contactFormPrefill, setContactFormPrefill] = useState(null);
  const [selectedReminderId, setSelectedReminderId] = useState(null);
  const [reminderFormOpen, setReminderFormOpen] = useState(false);
  const [reminderFormMode, setReminderFormMode] = useState("add");
  const [reminderFormPrefill, setReminderFormPrefill] = useState(null);
  const [deadlineEditDocId, setDeadlineEditDocId] = useState(null);
  const [manualDeadlineFormOpen, setManualDeadlineFormOpen] = useState(false);
  const [appealDocId, setAppealDocId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [fileIndex, setFileIndex] = useState(loadFileIndex);
  const [folderStatus, setFolderStatus] = useState({});
  const [indexing, setIndexing] = useState({
    active: false,
    current: 0,
    total: 0,
    name: "",
  });
  const folderHandlesRef = useRef(new Map());
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [templateFormType, setTemplateFormType] = useState(null);
  const [templateResult, setTemplateResult] = useState(null);
  const [userName, setUserName] = useState(() => {
    try {
      return localStorage.getItem(USER_NAME_KEY) || "";
    } catch {
      return "";
    }
  });
  const [tooltipsSeen, setTooltipsSeen] = useState(loadTooltipsSeen);
  const [successToast, setSuccessToast] = useState(null);
  const [notifPerm, setNotifPerm] = useState(() => {
    if (typeof Notification === "undefined") return "unsupported";
    return Notification.permission;
  });
  const [googleToken, setGoogleToken] = useState(loadGoogleToken);
  const [googleAutoExport, setGoogleAutoExport] = useState(() =>
    loadBoolPref(GOOGLE_AUTO_EXPORT_KEY, true)
  );
  const [googleShowCalendar, setGoogleShowCalendar] = useState(() =>
    loadBoolPref(GOOGLE_SHOW_CALENDAR_KEY, true)
  );
  const [googleEvents, setGoogleEvents] = useState([]);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [installDismissed, setInstallDismissed] = useState(() => {
    try {
      return localStorage.getItem(INSTALL_DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [browserTipSeen, setBrowserTipSeen] = useState(() => {
    try {
      return localStorage.getItem(BROWSER_TIP_SEEN_KEY) === "1";
    } catch {
      return false;
    }
  });

  function dismissBrowserTip() {
    try {
      localStorage.setItem(BROWSER_TIP_SEEN_KEY, "1");
    } catch {
      // ignore
    }
    setBrowserTipSeen(true);
  }

  const [billingStatus, setBillingStatus] = useState(null);
  // Query-Param aus dem Stripe-Checkout-Redirect wird nur beim allerersten
  // Render gelesen -- die URL wird gleich danach bereinigt (siehe Effekt
  // unten), ein erneuter Read nach dem Cleanup soll nichts mehr finden.
  const [billingRedirect] = useState(() =>
    new URLSearchParams(window.location.search).get("billing")
  );
  const [tarifIntroOpen, setTarifIntroOpen] = useState(false);
  // Bewusst kein localStorage-Flag: der Banner soll an jedem Login-Tag
  // während des Trials (Tag 2/3) wieder erscheinen, nicht nur einmal für
  // immer weggeklickt werden können wie die Tab-Tips.
  const [trialBannerDismissed, setTrialBannerDismissed] = useState(false);
  const [upsellAction, setUpsellAction] = useState(null);

  function openUpsell(action) {
    setUpsellAction(action);
  }

  function closeUpsell() {
    setUpsellAction(null);
  }

  function goToShopFromUpsell() {
    setUpsellAction(null);
    navigate("settings");
  }

  // Coming-soon-Modus deckt alle Google-Funktionen ab: Modals, Kalender-
  // Overlay und Auto-Export hängen sämtlich an googleConnected. Ein evtl.
  // vorhandenes Token bleibt in localStorage erhalten.
  const googleConnected =
    !GOOGLE_COMING_SOON &&
    !!googleToken &&
    googleToken.expiresAt > Date.now();
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [eventFormMode, setEventFormMode] = useState("add");
  const [eventFormPrefill, setEventFormPrefill] = useState(null);
  const [themeChoice, setThemeChoice] = useState(() => {
    try {
      const v = localStorage.getItem(THEME_KEY);
      return THEME_CHOICES.includes(v) ? v : "system";
    } catch {
      return "system";
    }
  });
  const [disclaimerOpen, setDisclaimerOpen] = useState(loadDisclaimerOpen);
  const [onboardingDone, setOnboardingDone] = useState(loadOnboardingDone);
  const [userEmail, setUserEmail] = useState(loadUserEmail);

  const userId = session?.user?.id || null;

  const [syncError, setSyncError] = useState(null);
  const onSyncError = (table, err) => {
    setSyncError({
      table,
      message: err?.message || String(err),
      hint: /column .* does not exist/i.test(err?.message || "")
        ? "Schema fehlt in Supabase — führe das SQL aus (siehe letzten Task)."
        : null,
    });
  };

  useEffect(() => {
    if (!userId || !dataReady) return;
    syncChainRef.current = syncChainRef.current.then(async () => {
      const docsPrev = docsPrevRef.current;
      docsPrevRef.current = docs;
      const contactsPrev = contactsPrevRef.current;
      contactsPrevRef.current = contacts;
      const remindersPrev = remindersPrevRef.current;
      remindersPrevRef.current = reminders;
      const eventsPrev = eventsPrevRef.current;
      eventsPrevRef.current = events;
      const savedTemplatesPrev = savedTemplatesPrevRef.current;
      savedTemplatesPrevRef.current = savedTemplates;

      try {
        // documents/contacts/saved_templates have no FK dependency on each
        // other — sync in parallel.
        await Promise.all([
          syncDiff("documents", docsPrev, docs, userId, onSyncError),
          syncDiff("contacts", contactsPrev, contacts, userId, onSyncError),
          syncDiff("saved_templates", savedTemplatesPrev, savedTemplates, userId, onSyncError),
        ]);
        // reminders/events reference doc_id and/or contact_id — must wait for the above.
        await Promise.all([
          syncDiff("reminders", remindersPrev, reminders, userId, onSyncError),
          syncDiff("events", eventsPrev, events, userId, onSyncError),
        ]);
      } catch (e) {
        console.error("sync run failed:", e);
      }
    });
  }, [docs, contacts, reminders, events, savedTemplates, userId, dataReady]);

  useEffect(() => {
    try {
      localStorage.setItem(
        TIPS_SEEN_KEY,
        JSON.stringify([...tooltipsSeen])
      );
    } catch {
      // ignore
    }
  }, [tooltipsSeen]);

  function markTooltipSeen(id) {
    setTooltipsSeen((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  useEffect(() => {
    try {
      localStorage.setItem(FILE_INDEX_KEY, JSON.stringify(fileIndex));
    } catch {
      // storage full — drop the extracted text to save space
      try {
        const trimmed = {
          folders: fileIndex.folders.map((f) => ({
            ...f,
            files: f.files.map((x) => ({ ...x, text: "" })),
          })),
        };
        localStorage.setItem(FILE_INDEX_KEY, JSON.stringify(trimmed));
      } catch {
        // give up
      }
    }
  }, [fileIndex]);

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      setAuthReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setDataReady(false);
        setDocs([]);
        setContacts([]);
        setReminders([]);
        setEvents([]);
        setSavedTemplates([]);
        docsPrevRef.current = [];
        contactsPrevRef.current = [];
        remindersPrevRef.current = [];
        eventsPrevRef.current = [];
        savedTemplatesPrevRef.current = [];
      }
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAll(userId);
        if (cancelled) return;
        docsPrevRef.current = data.docs;
        contactsPrevRef.current = data.contacts;
        remindersPrevRef.current = data.reminders;
        eventsPrevRef.current = data.events;
        savedTemplatesPrevRef.current = data.savedTemplates;
        setDocs(data.docs);
        setContacts(data.contacts);
        setReminders(data.reminders);
        setEvents(data.events);
        setSavedTemplates(data.savedTemplates);
        setDataReady(true);

        // Check for legacy localStorage data to migrate
        const legacy = {
          docs: loadDocs(),
          contacts: loadContacts(),
          reminders: loadReminders(),
          events: loadEvents(),
        };
        const total =
          legacy.docs.length +
          legacy.contacts.length +
          legacy.reminders.length +
          legacy.events.length;
        if (total > 0) {
          setMigrationPrompt({
            legacy,
            counts: {
              docs: legacy.docs.length,
              contacts: legacy.contacts.length,
              reminders: legacy.reminders.length,
              events: legacy.events.length,
            },
          });
        }
      } catch (e) {
        console.error("Initial data load failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function migrateLegacyData() {
    if (!migrationPrompt || !userId) return;
    setMigrationBusy(true);
    const { legacy } = migrationPrompt;
    try {
      await bulkInsert("documents", legacy.docs, userId);
      await bulkInsert("contacts", legacy.contacts, userId);
      await bulkInsert("reminders", legacy.reminders, userId);
      await bulkInsert("events", legacy.events, userId);
      // Merge into current state
      docsPrevRef.current = [...legacy.docs, ...docs];
      contactsPrevRef.current = [...legacy.contacts, ...contacts];
      remindersPrevRef.current = [...legacy.reminders, ...reminders];
      eventsPrevRef.current = [...legacy.events, ...events];
      setDocs((prev) => [...legacy.docs, ...prev]);
      setContacts((prev) => [...legacy.contacts, ...prev]);
      setReminders((prev) => [...legacy.reminders, ...prev]);
      setEvents((prev) => [...legacy.events, ...prev]);
      clearLegacyLocalStorage();
      setMigrationPrompt(null);
    } catch (e) {
      alert("Übertragung fehlgeschlagen: " + e.message);
    } finally {
      setMigrationBusy(false);
    }
  }

  function skipMigration() {
    clearLegacyLocalStorage();
    setMigrationPrompt(null);
  }

  function clearLegacyLocalStorage() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CONTACTS_KEY);
      localStorage.removeItem(REMINDERS_KEY);
      localStorage.removeItem(EVENTS_KEY);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!onboardingDone) return;
    sendDeadlineReminders(docs, reminders);
    // Only run when onboarding transitions to done (returning users on mount,
    // new users after they finish step 3). Docs snapshot at that moment is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingDone]);

  useEffect(() => {
    if (!onboardingDone) return;
    let seen = false;
    try {
      seen = !!localStorage.getItem(TARIF_INTRO_SEEN_KEY);
    } catch {
      // ignore
    }
    if (!seen) setTarifIntroOpen(true);
    // Gleiches Muster wie oben: nur beim Übergang zu onboardingDone prüfen,
    // nicht bei jedem Re-Render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingDone]);

  function closeTarifIntro() {
    try {
      localStorage.setItem(TARIF_INTRO_SEEN_KEY, "1");
    } catch {
      // ignore
    }
    setTarifIntroOpen(false);
  }

  useEffect(() => {
    if (tab !== "calendar") return;
    refreshGoogleEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, googleToken, googleShowCalendar]);

  // URL sofort bereinigen, unabhängig vom Auth-Zustand -- verhindert, dass
  // ein Reload denselben Redirect (und damit den Erfolgs-Toast) erneut
  // auslöst.
  useEffect(() => {
    if (!billingRedirect) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("billing");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [billingRedirect]);

  useEffect(() => {
    if (!dataReady) return;
    refreshBillingStatus();
    // Einmaliges Laden, sobald Nutzerdaten bereitstehen -- Trial-Banner und
    // Settings-Shop lesen billingStatus danach direkt aus dem State.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReady]);

  useEffect(() => {
    if (billingRedirect !== "success" || !dataReady) return;
    // Datenabruf selbst übernimmt der allgemeine Lade-Effekt oben (feuert
    // im selben Render-Zyklus bei dataReady) -- hier nur Navigation + Toast.
    setTab("settings");
    setSuccessToast("Zahlung erfolgreich — dein Tarif wurde aktualisiert.");
  }, [billingRedirect, dataReady]);

  useEffect(() => {
    function onPrompt(e) {
      e.preventDefault();
      setInstallPromptEvent(e);
    }
    function onInstalled() {
      setInstallPromptEvent(null);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstallClick() {
    if (!installPromptEvent) return;
    try {
      installPromptEvent.prompt();
      await installPromptEvent.userChoice;
    } catch {
      // ignore
    }
    setInstallPromptEvent(null);
  }

  function dismissInstallBanner() {
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
    setInstallDismissed(true);
  }

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, themeChoice);
    } catch {
      // ignore
    }
    const mm =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;
    function apply() {
      const resolved =
        themeChoice === "dark" ||
        (themeChoice === "system" && mm && mm.matches)
          ? "dark"
          : "light";
      document.documentElement.dataset.theme = resolved;
    }
    apply();
    if (themeChoice === "system" && mm) {
      const handler = () => apply();
      if (mm.addEventListener) mm.addEventListener("change", handler);
      else mm.addListener(handler);
      return () => {
        if (mm.removeEventListener) mm.removeEventListener("change", handler);
        else mm.removeListener(handler);
      };
    }
  }, [themeChoice]);

  function cycleTheme() {
    const i = THEME_CHOICES.indexOf(themeChoice);
    setThemeChoice(THEME_CHOICES[(i + 1) % THEME_CHOICES.length]);
  }

  useEffect(() => {
    try {
      if (googleToken) {
        localStorage.setItem(GOOGLE_TOKEN_KEY, JSON.stringify(googleToken));
      } else {
        localStorage.removeItem(GOOGLE_TOKEN_KEY);
      }
    } catch {
      // ignore
    }
  }, [googleToken]);

  useEffect(() => {
    try {
      localStorage.setItem(GOOGLE_AUTO_EXPORT_KEY, googleAutoExport ? "1" : "0");
    } catch {
      // ignore
    }
  }, [googleAutoExport]);

  useEffect(() => {
    try {
      localStorage.setItem(GOOGLE_SHOW_CALENDAR_KEY, googleShowCalendar ? "1" : "0");
    } catch {
      // ignore
    }
  }, [googleShowCalendar]);

  async function connectGoogle() {
    if (GOOGLE_COMING_SOON) return;
    if (!GOOGLE_CONFIGURED) {
      alert(
        "Google Client-ID nicht konfiguriert. Setze VITE_GOOGLE_CLIENT_ID in der .env-Datei."
      );
      return;
    }
    setGoogleBusy(true);
    try {
      const result = await googleSignIn();
      setGoogleToken(result);
    } catch (e) {
      alert("Google-Anmeldung fehlgeschlagen: " + e.message);
    } finally {
      setGoogleBusy(false);
    }
  }

  async function disconnectGoogle() {
    if (googleToken?.accessToken) {
      googleRevoke(googleToken.accessToken).catch(() => {});
    }
    setGoogleToken(null);
    setGoogleEvents([]);
  }

  async function exportItemToGoogle(item, kind) {
    if (!googleConnected) return null;
    const payload = bueroItemToGoogleEvent(item, kind);
    if (!payload) return null;
    try {
      return await googleCreateEvent(googleToken.accessToken, payload);
    } catch (e) {
      if (e.message === "token_expired") {
        setGoogleToken(null);
      }
      // silent for individual exports
      console.error("Google export failed:", e);
      return null;
    }
  }

  function exportCalendarICS(scope) {
    const entries = [];
    if (scope === "all" || scope === "deadlines") {
      for (const d of docs) {
        if (d.deadline && isActive(d.status)) {
          entries.push(docToIcsEntry(d));
        }
      }
    }
    if (scope === "all" || scope === "reminders") {
      for (const r of reminders) {
        if (r.date && !r.done) {
          entries.push(reminderToIcsEntry(r));
        }
      }
    }
    if (scope === "all") {
      for (const e of events) {
        if (e.date) entries.push(eventToIcsEntry(e));
      }
    }
    if (entries.length === 0) {
      alert("Keine passenden Einträge zum Exportieren.");
      return;
    }
    const filename =
      scope === "deadlines"
        ? "buero-fristen.ics"
        : scope === "reminders"
        ? "buero-erinnerungen.ics"
        : "buero-kalender.ics";
    downloadICS(filename, entries);
  }

  function exportDocToICS(doc) {
    if (!doc?.deadline) return;
    downloadICS("buero-frist.ics", [docToIcsEntry(doc)]);
  }

  function exportReminderToICS(reminder) {
    if (!reminder?.date) return;
    downloadICS("buero-erinnerung.ics", [reminderToIcsEntry(reminder)]);
  }

  function exportEventToICS(event) {
    if (!event?.date) return;
    downloadICS("buero-termin.ics", [eventToIcsEntry(event)]);
  }

  async function refreshGoogleEvents() {
    if (!googleConnected || !googleShowCalendar) {
      setGoogleEvents([]);
      return;
    }
    const now = new Date();
    const later = new Date();
    later.setDate(later.getDate() + 30);
    try {
      const data = await googleListEvents(
        googleToken.accessToken,
        now.toISOString(),
        later.toISOString()
      );
      const items = (data.items || []).filter(
        (e) => e.extendedProperties?.private?.source !== "buero"
      );
      setGoogleEvents(items);
    } catch (e) {
      if (e.message === "token_expired") {
        setGoogleToken(null);
        setGoogleEvents([]);
      } else {
        console.error("Failed to load Google events:", e);
      }
    }
  }

  async function refreshBillingStatus() {
    if (!session?.access_token) return;
    try {
      const res = await authFetch(
        `${API_BASE}/api/billing/status`,
        {},
        session.access_token
      );
      if (!res.ok) return;
      setBillingStatus(await res.json());
    } catch (e) {
      // Tarif-Status ist ergänzende UI, kein Blocker für die Kernfunktionen
      // der App -- ein fehlgeschlagener Ladeversuch darf nichts anderes
      // stören, nur geloggt werden.
      console.error("Failed to load billing status:", e);
    }
  }

  async function startCheckout(type) {
    if (!session?.access_token) return;
    try {
      const res = await authFetch(
        `${API_BASE}/api/billing/checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type }),
        },
        session.access_token
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const { url } = await res.json();
      // Voller Redirect zu Stripes gehosteter Checkout-Seite -- kein
      // eingebettetes Formular, keine Kartendaten in unserer App.
      window.location.href = url;
    } catch (e) {
      alert("Checkout konnte nicht gestartet werden: " + e.message);
    }
  }

  async function requestNotifPermission() {
    if (typeof Notification === "undefined") return;
    try {
      const p = await Notification.requestPermission();
      setNotifPerm(p);
    } catch {
      // ignore
    }
  }

  function updateUserEmail(next) {
    setUserEmail(next);
    try {
      localStorage.setItem(EMAIL_KEY, next);
    } catch {
      // ignore
    }
  }

  function exportAllData() {
    const bundle = {
      exportedAt: new Date().toISOString(),
      version: APP_VERSION,
      email: userEmail,
      userName,
      themeChoice,
      docs,
      contacts,
      reminders,
      events,
      savedTemplates,
      fileIndex,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `buero-export-${isoLocal(TODAY)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function deleteAllData() {
    const first = confirm(
      "Wirklich ALLE Daten löschen? Dokumente, Kontakte, Erinnerungen, Termine und alle Einstellungen gehen verloren."
    );
    if (!first) return;
    const second = confirm(
      "Ganz sicher? Das kann nicht rückgängig gemacht werden."
    );
    if (!second) return;
    // Delete Supabase-side data first (RLS keeps this scoped to user)
    if (userId) {
      try {
        await Promise.all([
          supabase.from("documents").delete().eq("user_id", userId),
          supabase.from("contacts").delete().eq("user_id", userId),
          supabase.from("reminders").delete().eq("user_id", userId),
          supabase.from("events").delete().eq("user_id", userId),
          supabase.from("saved_templates").delete().eq("user_id", userId),
        ]);
      } catch (e) {
        console.error("Cloud delete failed:", e);
      }
    }
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
    try {
      if (typeof indexedDB !== "undefined") {
        indexedDB.deleteDatabase(IDB_NAME);
      }
    } catch {
      // ignore
    }
    try {
      if (session) await supabase.auth.signOut();
    } catch {
      // ignore
    }
    location.reload();
  }

  useEffect(() => {
    if (!FS_SUPPORTED) return;
    let cancelled = false;
    (async () => {
      let stored;
      try {
        stored = await idbGetAll();
      } catch {
        return;
      }
      if (cancelled) return;
      const currentIndex = loadFileIndex();
      const knownIds = new Set(currentIndex.folders.map((f) => f.id));
      for (const { id, handle } of stored) {
        if (knownIds.has(id)) folderHandlesRef.current.set(id, handle);
      }
      const statuses = {};
      for (const folder of currentIndex.folders) {
        const handle = folderHandlesRef.current.get(folder.id);
        if (!handle) {
          statuses[folder.id] = "missing";
          continue;
        }
        try {
          const perm = await handle.queryPermission({ mode: "read" });
          statuses[folder.id] = perm === "granted" ? "granted" : "stale";
        } catch {
          statuses[folder.id] = "stale";
        }
      }
      if (cancelled) return;
      setFolderStatus(statuses);

      for (const folder of currentIndex.folders) {
        if (statuses[folder.id] !== "granted") continue;
        const handle = folderHandlesRef.current.get(folder.id);
        try {
          const { files, changed } = await syncFolderIncremental(
            handle,
            folder.files,
            null
          );
          if (cancelled) return;
          if (changed) {
            setFileIndex((prev) => ({
              folders: prev.folders.map((f) =>
                f.id === folder.id
                  ? { ...f, files, indexedAt: isoLocal(TODAY) }
                  : f
              ),
            }));
          }
        } catch {
          // ignore per-folder sync failures
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedDoc = docs.find((d) => d.id === selectedId);

  function buildDocFromResult(result) {
    const today = isoLocal(TODAY);
    const deadline = result.deadline || null;
    return {
      id: "d" + Date.now(),
      title: result.documentType || result.filename || "Dokument",
      sender: result.sender || "",
      category: result.category || "Sonstiges",
      date: today,
      deadline,
      deadlineType: deadline
        ? (DEADLINE_TYPES.includes(result.deadlineType)
            ? result.deadlineType
            : "sonstiges")
        : null,
      amount: result.amount ?? null,
      summary: result.summary || null,
      fullText: result.fullText || null,
      replyDraft: result.replyDraft || null,
      // Claude may suggest this document has no meaningful status at all
      // (e.g. a certificate) — shown as an overridable suggestion in
      // PostScanModal, same pattern as recurring below. No tri-state needed
      // here (unlike recurring) since there's no heuristic to defer to —
      // "Offen" is always a safe resting default either way.
      status: result.noStatusNeeded ? null : "Offen",
      notes: null,
      // Tri-state: null = never explicitly decided, true/false = binding
      // (see getRecurringPaymentDocIds). Must not collapse null to false.
      recurring: result.recurring == null ? null : !!result.recurring,
      qrCodes: Array.isArray(result.qrCodes) ? result.qrCodes : [],
      filename: result.filename || null,
    };
  }

  function handlePostScanConfirm(chosenActions, overrides = {}) {
    if (!pendingResult) return;
    const doc = buildDocFromResult({
      ...pendingResult,
      ...(overrides.category !== undefined
        ? { category: overrides.category }
        : {}),
      ...(overrides.recurring !== undefined
        ? { recurring: overrides.recurring }
        : {}),
      ...(overrides.noStatusNeeded !== undefined
        ? { noStatusNeeded: overrides.noStatusNeeded }
        : {}),
    });
    const newReminders = [];
    const newEvents = [];
    const noteParts = [];
    let contactPrefill = null;

    for (const a of chosenActions) {
      if (!a.value) continue;
      if (a.type === "amount") {
        const n = typeof a.value === "number" ? a.value : Number(a.value);
        if (Number.isFinite(n)) doc.amount = n;
      } else if (a.type === "deadline") {
        doc.deadline = a.value;
      } else if (a.type === "note") {
        noteParts.push(String(a.value));
      } else if (a.type === "reminder") {
        newReminders.push({
          id: "r" + Date.now() + Math.random().toString(36).slice(2, 6),
          docId: doc.id,
          title: doc.title,
          date: a.value,
          done: false,
        });
      } else if (a.type === "event" && a.value && typeof a.value === "object") {
        const v = a.value;
        if (v.title && v.date) {
          newEvents.push({
            id: "e" + Date.now() + Math.random().toString(36).slice(2, 6),
            title: v.title,
            date: v.date,
            time: v.time || "",
            notes: v.notes || "",
            contactId: null,
            docId: doc.id,
          });
        }
      } else if (a.type === "contact" && !contactPrefill) {
        const info =
          typeof a.value === "object" && a.value
            ? a.value
            : { name: String(a.value) };
        const name = (info.name || "").trim();
        if (!name) continue;
        // Substring match (same rule insights.js uses for sender<->contact
        // linking elsewhere) — an exact-name check would miss e.g. a Claude
        // suggestion "Telekom Deutschland GmbH" against an existing contact
        // stored as just "Telekom", creating an avoidable duplicate.
        const existing = contacts.find((c) =>
          senderMatchesContactName(name, c.name)
        );
        if (!existing) {
          const notesParts = [
            info.notes,
            info.website ? `Website: ${info.website}` : null,
          ].filter(Boolean);
          contactPrefill = {
            name,
            type:
              (info.type && CONTACT_TYPES.includes(info.type)
                ? info.type
                : null) ||
              CATEGORY_TO_CONTACT_TYPE[doc.category] ||
              "Sonstiges",
            email: info.email || "",
            phone: info.phone || "",
            street: info.street || "",
            zip: info.zip || "",
            city: info.city || "",
            iban: info.iban || "",
            bic: info.bic || "",
            notes: notesParts.join("\n\n"),
          };
        }
      }
    }

    if (noteParts.length) doc.notes = noteParts.join("\n\n");

    setDocs((prev) => [doc, ...prev]);
    if (newReminders.length) {
      setReminders((prev) => [...newReminders, ...prev]);
    }
    if (newEvents.length) {
      setEvents((prev) => [...newEvents, ...prev]);
    }
    setPendingResult(null);
    setScanCategoryPrefill(null);

    if (contactPrefill) {
      setContactFormMode("add");
      setContactFormPrefill(contactPrefill);
      setContactFormOpen(true);
    }

    if (googleConnected && googleAutoExport) {
      if (doc.deadline) exportItemToGoogle(doc, "deadline");
      for (const r of newReminders) exportItemToGoogle(r, "reminder");
      for (const e of newEvents) exportItemToGoogle(e, "event");
    }

    celebrateFirstScan();
  }

  function handlePostScanSkip() {
    if (!pendingResult) return;
    // Skipping means the user never reviewed the recurring checkbox at all
    // — same "undecided" outcome as leaving it untouched and confirming.
    setDocs((prev) => [
      buildDocFromResult({ ...pendingResult, recurring: null }),
      ...prev,
    ]);
    setPendingResult(null);
    setScanCategoryPrefill(null);
    celebrateFirstScan();
  }

  function celebrateFirstScan() {
    if (tooltipsSeen.has("first_scan_done")) return;
    markTooltipSeen("first_scan_done");
    markTooltipSeen("scan");
    setSuccessToast("Dein erstes Dokument ist gespeichert.");
    setTab("home");
  }

  function toggleReminder(id) {
    const reminder = reminders.find((r) => r.id === id);
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, done: !r.done } : r))
    );
    // Completing an appeal reminder doesn't auto-close out the document's
    // status — the outcome might still be pending. Ask instead of deciding
    // for the user, same "suggest, don't force" principle as the Laufend
    // nudge in saveReminder above. Covers both entry points that funnel
    // through this function (Home's quick-toggle, ReminderDetailModal).
    if (reminder && !reminder.done && reminder.kind === "appeal" && reminder.docId) {
      const doc = docs.find((d) => d.id === reminder.docId);
      if (doc && doc.status !== "Erledigt") {
        if (confirm(`Status von "${doc.title}" auf Erledigt setzen?`)) {
          setDocStatus(doc.id, "Erledigt");
        }
      }
    }
  }

  function toggleStatus(id) {
    setDocs((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, status: d.status === "Erledigt" ? "Offen" : "Erledigt" }
          : d
      )
    );
  }

  function setDocStatus(id, value) {
    setDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: value } : d))
    );
  }

  function deleteDoc(id) {
    const d = docs.find((x) => x.id === id);
    if (!d) return;
    if (!confirm(`Dokument "${d.title}" wirklich löschen?`)) return;
    setDocs((prev) => prev.filter((x) => x.id !== id));
    setReminders((prev) =>
      prev.map((r) =>
        r.docId === id ? { ...r, docId: null, orphaned: true } : r
      )
    );
    setSelectedId(null);
  }

  function openDeadlineEdit(id) {
    setDeadlineEditDocId(id);
  }

  function openManualDeadline() {
    setManualDeadlineFormOpen(true);
  }

  function saveManualDeadline(data) {
    const doc = {
      id: "d" + Date.now(),
      title: data.title,
      sender: data.sender || "",
      category: data.category || "Sonstiges",
      date: isoLocal(TODAY),
      deadline: data.deadline || null,
      deadlineType: data.deadline ? data.deadlineType || "sonstiges" : null,
      amount: data.amount ?? null,
      summary: null,
      replyDraft: null,
      status: "Offen",
      notes: data.notes || null,
      filename: null,
      manual: true,
    };
    setDocs((prev) => [doc, ...prev]);
    setManualDeadlineFormOpen(false);
    if (data.syncToGoogle && doc.deadline) {
      exportItemToGoogle(doc, "deadline");
    }
  }

  function saveDeadlineEdit({ deadline, deadlineType }) {
    if (!deadlineEditDocId) return;
    setDocs((prev) =>
      prev.map((d) =>
        d.id === deadlineEditDocId ? { ...d, deadline, deadlineType } : d
      )
    );
    setDeadlineEditDocId(null);
  }

  function openAddReminder(prefill = null) {
    setReminderFormMode("add");
    setSelectedReminderId(null);
    setReminderFormPrefill(prefill);
    setReminderFormOpen(true);
  }

  function openEditReminder() {
    setReminderFormMode("edit");
    setReminderFormPrefill(null);
    setReminderFormOpen(true);
  }

  function closeReminderForm() {
    setReminderFormOpen(false);
    setReminderFormPrefill(null);
  }

  function saveReminder(data) {
    const { syncToGoogle, ...rest } = data;
    if (reminderFormMode === "edit" && selectedReminderId) {
      setReminders((prev) =>
        prev.map((r) =>
          r.id === selectedReminderId ? { ...r, ...rest } : r
        )
      );
    } else {
      const created = {
        id: "r" + Date.now(),
        done: false,
        ...rest,
      };
      setReminders((prev) => [created, ...prev]);
      if (syncToGoogle && created.date) {
        exportItemToGoogle(created, "reminder");
      }
      // A newly created appeal reminder suggests the document is now "in
      // progress" — only nudge status if it's still at the default "Offen".
      // Erledigt or an already-set Laufend reflects a conscious decision
      // the automation shouldn't overwrite.
      if (created.kind === "appeal" && created.docId) {
        setDocs((prev) =>
          prev.map((d) =>
            d.id === created.docId && d.status === "Offen"
              ? { ...d, status: "Laufend" }
              : d
          )
        );
      }
    }
    closeReminderForm();
  }

  function openAppeal(docId) {
    setAppealDocId(docId);
  }

  function handleAppealScheduleReminder() {
    const d = docs.find((x) => x.id === appealDocId);
    if (!d) return;
    const targetDate = d.deadline
      ? addDays(d.deadline, -7)
      : todayIso();
    const finalDate =
      targetDate < todayIso() ? todayIso() : targetDate;
    setAppealDocId(null);
    openAddReminder({
      title: `Widerspruch vorbereiten: ${d.title}`,
      date: finalDate,
      docId: d.id,
      daysBefore: 3,
      kind: "appeal",
    });
  }

  function handleAppealShowReplyDraft() {
    const id = appealDocId;
    setAppealDocId(null);
    if (id) setSelectedId(id);
  }

  async function addFolder() {
    if (!FS_SUPPORTED) return;
    let handle;
    try {
      handle = await window.showDirectoryPicker({ mode: "read" });
    } catch {
      return;
    }
    const id = "f" + Date.now();
    folderHandlesRef.current.set(id, handle);
    try {
      await idbPut(id, handle);
    } catch {
      // ignore
    }
    setIndexing({ active: true, current: 0, total: 0, name: handle.name });
    try {
      const files = await indexFolderFully(handle, (p) =>
        setIndexing({ active: true, ...p })
      );
      const folder = {
        id,
        name: handle.name,
        addedAt: isoLocal(TODAY),
        indexedAt: isoLocal(TODAY),
        files,
      };
      setFileIndex((prev) => ({ folders: [folder, ...prev.folders] }));
      setFolderStatus((prev) => ({ ...prev, [id]: "granted" }));
    } catch (e) {
      alert("Indizierung fehlgeschlagen: " + e.message);
      folderHandlesRef.current.delete(id);
      idbDelete(id).catch(() => {});
    } finally {
      setIndexing({ active: false, current: 0, total: 0, name: "" });
    }
  }

  async function removeFolder(id) {
    const f = fileIndex.folders.find((x) => x.id === id);
    if (!f) return;
    if (!confirm(`Ordner "${f.name}" entfernen?`)) return;
    folderHandlesRef.current.delete(id);
    try {
      await idbDelete(id);
    } catch {
      // ignore
    }
    setFileIndex((prev) => ({
      folders: prev.folders.filter((x) => x.id !== id),
    }));
    setFolderStatus((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function refreshFolder(id) {
    const handle = folderHandlesRef.current.get(id);
    if (!handle) return;
    try {
      const perm = await handle.requestPermission({ mode: "read" });
      if (perm !== "granted") return;
    } catch {
      return;
    }
    setFolderStatus((prev) => ({ ...prev, [id]: "granted" }));
    setIndexing({ active: true, current: 0, total: 0, name: handle.name });
    try {
      const folder = fileIndex.folders.find((x) => x.id === id);
      const { files } = await syncFolderIncremental(
        handle,
        folder ? folder.files : [],
        (p) => setIndexing({ active: true, ...p })
      );
      setFileIndex((prev) => ({
        folders: prev.folders.map((f) =>
          f.id === id ? { ...f, files, indexedAt: isoLocal(TODAY) } : f
        ),
      }));
    } catch (e) {
      alert("Re-Indizierung fehlgeschlagen: " + e.message);
    } finally {
      setIndexing({ active: false, current: 0, total: 0, name: "" });
    }
  }

  async function openLocalFile(item) {
    const handle = folderHandlesRef.current.get(item.folderId);
    if (!handle) {
      alert("Ordner nicht mehr verfügbar. Bitte im Einstellungen-Tab neu freigeben.");
      return;
    }
    try {
      const perm = await handle.queryPermission({ mode: "read" });
      if (perm !== "granted") {
        const ask = await handle.requestPermission({ mode: "read" });
        if (ask !== "granted") return;
      }
      const file = await resolveFileFromHandle(handle, item.path);
      const url = URL.createObjectURL(file);
      const win = window.open(url, "_blank");
      if (!win) {
        alert("Popup-Blocker verhindert das Öffnen der Datei.");
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      alert("Datei konnte nicht geöffnet werden: " + e.message);
    }
  }

  function openTemplateForm(id) {
    setTemplateResult(null);
    setTemplateFormType(id);
  }

  async function submitTemplateRequest(payload) {
    if (payload.senderName) {
      try {
        localStorage.setItem(USER_NAME_KEY, payload.senderName);
      } catch {
        // ignore
      }
      setUserName(payload.senderName);
    }
    const res = await authFetch(
      `${API_BASE}/api/template`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      session?.access_token
    );
    if (res.status === 402) {
      // Formular schließen statt generischer Inline-Fehlermeldung — der
      // Upsell übernimmt die Erklärung.
      setTemplateFormType(null);
      openUpsell("template");
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    const result = await res.json();
    setTemplateFormType(null);
    setTemplateResult({
      ...result,
      // Inherited from the reference doc/recipient chosen in the form — Claude
      // never sees or returns these, it's pure client-side bookkeeping.
      category: payload.linkedDoc?.category || null,
      sender: payload.recipient?.name || payload.linkedDoc?.sender || null,
    });
  }

  function saveTemplateAsDoc(category) {
    if (!templateResult) return;
    const doc = {
      id: "d" + Date.now(),
      title: templateResult.subject || templateResult.templateLabel || "Anschreiben",
      sender: templateResult.sender || "",
      category: category || "Vorlagen",
      date: isoLocal(TODAY),
      deadline: null,
      deadlineType: null,
      amount: null,
      summary: `Vorlage: ${templateResult.templateLabel}`,
      replyDraft: templateResult.body,
      status: "Offen",
      notes: null,
      filename: null,
      manual: true,
      source: "template",
    };
    setDocs((prev) => [doc, ...prev]);
  }

  function saveResultAsTemplate() {
    if (!templateResult) return;
    const tpl = {
      id: "t" + Date.now(),
      templateType: templateResult.templateType,
      title: templateResult.subject || templateResult.templateLabel || "Vorlage",
      body: templateResult.body,
    };
    setSavedTemplates((prev) => [tpl, ...prev]);
  }

  function useSavedTemplate(tpl) {
    // Reuse a saved template directly — no Claude call, no linked
    // doc/recipient (that context was specific to the original case).
    setTemplateFormType(null);
    setTemplateResult({
      subject: tpl.title,
      body: tpl.body,
      templateType: tpl.templateType,
      templateLabel:
        TEMPLATE_TYPES.find((t) => t.id === tpl.templateType)?.label || "Vorlage",
      category: null,
      sender: null,
    });
  }

  function deleteSavedTemplate(id) {
    setSavedTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  function openAddEvent(dateIso) {
    setEventFormMode("add");
    setSelectedEventId(null);
    setEventFormPrefill(dateIso ? { date: dateIso } : null);
    setEventFormOpen(true);
  }

  function openEditEvent() {
    setEventFormMode("edit");
    setEventFormPrefill(null);
    setEventFormOpen(true);
  }

  function closeEventForm() {
    setEventFormOpen(false);
    setEventFormPrefill(null);
  }

  function saveEvent(data) {
    const { syncToGoogle, ...rest } = data;
    if (eventFormMode === "edit" && selectedEventId) {
      setEvents((prev) =>
        prev.map((e) => (e.id === selectedEventId ? { ...e, ...rest } : e))
      );
    } else {
      const created = { id: "e" + Date.now(), ...rest };
      setEvents((prev) => [created, ...prev]);
      if (syncToGoogle && created.date) {
        exportItemToGoogle(created, "event");
      }
    }
    closeEventForm();
  }

  function deleteEvent() {
    if (!selectedEventId) return;
    if (!confirm("Termin wirklich löschen?")) return;
    setEvents((prev) => prev.filter((e) => e.id !== selectedEventId));
    setSelectedEventId(null);
  }

  function deleteReminder() {
    if (!selectedReminderId) return;
    if (!confirm("Erinnerung wirklich löschen?")) return;
    setReminders((prev) => prev.filter((r) => r.id !== selectedReminderId));
    setSelectedReminderId(null);
  }

  function toggleSelectedReminderDone() {
    if (!selectedReminderId) return;
    toggleReminder(selectedReminderId);
  }

  function navigate(nextTab) {
    if (nextTab !== "archive") setCategoryFilter(null);
    if (nextTab !== "categories") setSelectedCategory(null);
    setScanCategoryPrefill(null);
    setTab(nextTab);
  }

  function scanWithCategory(category) {
    setScanCategoryPrefill(category);
    setTab("scan"); // bypass navigate() — it would clear the prefill we just set
  }

  function openCategory(category) {
    setSelectedCategory(category);
    setTab("categories"); // bypass navigate() — it would clear the selection we just set
  }

  function openAddContact() {
    setContactFormMode("add");
    setContactFormPrefill(null);
    setContactFormOpen(true);
  }

  function closeContactForm() {
    setContactFormOpen(false);
    setContactFormPrefill(null);
  }

  function saveContact(data) {
    if (contactFormMode === "edit" && selectedContactId) {
      setContacts((prev) =>
        prev.map((c) => (c.id === selectedContactId ? { ...c, ...data } : c))
      );
    } else {
      setContacts((prev) => [{ ...data, id: "c" + Date.now() }, ...prev]);
    }
    closeContactForm();
  }

  function deleteContact() {
    const c = contacts.find((x) => x.id === selectedContactId);
    if (!c) return;
    if (!confirm(`Kontakt "${c.name}" wirklich löschen?`)) return;
    setContacts((prev) => prev.filter((x) => x.id !== selectedContactId));
    setEvents((prev) =>
      prev.map((e) =>
        e.contactId === selectedContactId
          ? { ...e, contactId: null, orphaned: true }
          : e
      )
    );
    setSelectedContactId(null);
  }

  function acknowledgeDisclaimer() {
    try {
      localStorage.setItem(DISCLAIMER_KEY, "1");
    } catch {
      // ignore
    }
    setDisclaimerOpen(false);
  }

  function completeOnboarding(email, landing = "home") {
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      // ignore
    }
    setUserEmail(email);
    setOnboardingDone(true);
    setTab(landing === "scan" ? "scan" : "home");
  }

  async function signOut() {
    if (!confirm("Wirklich abmelden?")) return;
    try {
      await supabase.auth.signOut();
    } catch (e) {
      alert("Abmelden fehlgeschlagen: " + e.message);
    }
  }

  // Derive email from session (Supabase is now the source of truth)
  const authEmail = session?.user?.email || userEmail;

  // Hooks (useMemo etc.) MUST live before any early-return to keep hook order stable.
  const existingCategories = useMemo(() => {
    const set = new Set();
    for (const d of docs) {
      if (d.category) set.add(d.category);
    }
    return [...set].sort();
  }, [docs]);

  if (!authReady) {
    return null;
  }

  if (!SUPABASE_CONFIGURED) {
    return <AuthConfigMissingScreen />;
  }

  // Disclaimer gates everything on fresh install
  if (disclaimerOpen) {
    return (
      <div className="app">
        <DisclaimerModal onAcknowledge={acknowledgeDisclaimer} />
      </div>
    );
  }

  // Onboarding covers ALL not-yet-in-the-app cases:
  //   - Fresh visitor: full 3-step flow (welcome → auth → ready)
  //   - Returning user after logout: same component, jump to step 2 (auth)
  //   - Signed in but didn't finish orientation: jump to step 3 (ready)
  if (!session || !onboardingDone) {
    return (
      <OnboardingScreen
        session={session}
        skipWelcome={onboardingDone}
        onDone={completeOnboarding}
      />
    );
  }

  if (!dataReady) {
    return null;
  }

  const hasStaleFolders = fileIndex.folders.some((f) => {
    const s = folderStatus[f.id];
    return s === "stale" || s === "missing";
  });
  const navBadges = { settings: hasStaleFolders };

  function updateDocCategory(id, category) {
    const trimmed = (category || "").trim();
    if (!trimmed) return;
    setDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, category: trimmed } : d))
    );
  }

  function renameCategory(oldName, newName) {
    const trimmed = (newName || "").trim();
    if (!trimmed || trimmed === oldName) return;
    setDocs((prev) =>
      prev.map((d) =>
        (d.category || "Sonstiges") === oldName
          ? { ...d, category: trimmed }
          : d
      )
    );
  }

  function removeCategory(name) {
    setDocs((prev) =>
      prev.map((d) =>
        (d.category || "Sonstiges") === name
          ? { ...d, category: "Sonstiges" }
          : d
      )
    );
  }

  return (
    <div className="app">
      <Sidebar
        active={tab}
        onChange={navigate}
        userEmail={authEmail}
        onOpenSearch={() => setSearchOpen(true)}
        badges={navBadges}
        themeChoice={themeChoice}
        onCycleTheme={cycleTheme}
        onSignOut={signOut}
      />
      <button
        type="button"
        className="search-fab"
        onClick={() => setSearchOpen(true)}
        aria-label="Suche öffnen"
      >
        <IconSearch size={20} />
      </button>
      <main className="main">
        {!FS_SUPPORTED && !browserTipSeen && (
          <TabTip text={BROWSER_TIP_TEXT} onDismiss={dismissBrowserTip} />
        )}
        {billingStatus?.tier === "trial" &&
          billingStatus.trialDaysRemaining <= 2 &&
          !trialBannerDismissed && (
            <TabTip
              text={`Noch ${billingStatus.trialDaysRemaining} Tag${billingStatus.trialDaysRemaining === 1 ? "" : "e"} Smart im Trial — danach geht's mit Basic (10 Gratis-Scans/Monat) weiter, oder du bleibst für 3,90€/Monat bei Smart.`}
              onDismiss={() => setTrialBannerDismissed(true)}
            />
          )}
        {TAB_TIPS[tab] &&
          !tooltipsSeen.has(tab) &&
          !(tab === "scan" && !tooltipsSeen.has("first_scan_done")) && (
            <TabTip
              text={TAB_TIPS[tab]}
              onDismiss={() => markTooltipSeen(tab)}
            />
          )}
        {tab === "home" && (
          <HomeView
            docs={docs}
            contacts={contacts}
            reminders={reminders}
            onNav={navigate}
            onOpenDoc={setSelectedId}
            onOpenContact={setSelectedContactId}
            onOpenCategory={openCategory}
            onOpenReminder={setSelectedReminderId}
            onAddReminder={() => openAddReminder()}
            onAddDeadline={openManualDeadline}
            onToggleReminder={toggleReminder}
            onToggleDocStatus={toggleStatus}
            onEditDeadline={openDeadlineEdit}
            onOpenAppeal={openAppeal}
          />
        )}
        {tab === "calendar" && (
          <CalendarView
            docs={docs}
            reminders={reminders}
            events={events}
            googleEvents={googleShowCalendar ? googleEvents : []}
            contacts={contacts}
            onOpenDoc={setSelectedId}
            onOpenReminder={setSelectedReminderId}
            onOpenEvent={setSelectedEventId}
            onOpenGoogleEvent={(ge) => {
              if (ge.htmlLink) window.open(ge.htmlLink, "_blank");
            }}
            onAddEvent={openAddEvent}
          />
        )}
        {tab === "scan" && (
          <ScanView
            docs={docs}
            contacts={contacts}
            isFirstScan={!tooltipsSeen.has("first_scan_done")}
            accessToken={session?.access_token}
            onScanned={setPendingResult}
            onQuotaExceeded={openUpsell}
            onOpenDoc={setSelectedId}
            onPickTemplate={openTemplateForm}
            savedTemplates={savedTemplates}
            onUseSavedTemplate={useSavedTemplate}
            onDeleteSavedTemplate={deleteSavedTemplate}
          />
        )}
        {tab === "categories" && (
          <CategoriesView
            docs={docs}
            contacts={contacts}
            existingCategories={existingCategories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onNav={navigate}
            onOpenDoc={setSelectedId}
            onOpenContact={setSelectedContactId}
            onUpdateDocCategory={updateDocCategory}
            onRenameCategory={renameCategory}
            onRemoveCategory={removeCategory}
            onScanWithCategory={scanWithCategory}
          />
        )}
        {tab === "contacts" && (
          <ContactsView
            contacts={contacts}
            onAdd={openAddContact}
            onOpenDetail={setSelectedContactId}
          />
        )}
        {tab === "archive" && (
          <ArchiveView
            docs={docs}
            categoryFilter={categoryFilter}
            onClearCategoryFilter={() => setCategoryFilter(null)}
            onOpenDoc={setSelectedId}
            existingCategories={existingCategories}
            onUpdateCategory={updateDocCategory}
          />
        )}
        {tab === "settings" && (
          <SettingsView
            folders={fileIndex.folders}
            folderStatus={folderStatus}
            indexing={indexing}
            themeChoice={themeChoice}
            onSetTheme={setThemeChoice}
            onAddFolder={addFolder}
            onRemoveFolder={removeFolder}
            onRefreshFolder={refreshFolder}
            userEmail={userEmail}
            onUpdateEmail={updateUserEmail}
            notifPerm={notifPerm}
            onRequestNotif={requestNotifPermission}
            onExportData={exportAllData}
            onDeleteAll={deleteAllData}
            googleConnected={googleConnected}
            googleBusy={googleBusy}
            googleAutoExport={googleAutoExport}
            googleShowCalendar={googleShowCalendar}
            onGoogleConnect={connectGoogle}
            onGoogleDisconnect={disconnectGoogle}
            onSetGoogleAutoExport={setGoogleAutoExport}
            onSetGoogleShowCalendar={setGoogleShowCalendar}
            onExportCalendar={exportCalendarICS}
            billingStatus={billingStatus}
            onStartCheckout={startCheckout}
          />
        )}
      </main>
      <BottomNav active={tab} onChange={navigate} badges={navBadges} />

      {selectedDoc && !deadlineEditDocId && (
        <DocumentModal
          doc={selectedDoc}
          existingCategories={existingCategories}
          onClose={() => setSelectedId(null)}
          onToggleStatus={() => toggleStatus(selectedDoc.id)}
          onSetStatus={(value) => setDocStatus(selectedDoc.id, value)}
          onEditDeadline={() => openDeadlineEdit(selectedDoc.id)}
          onDelete={() => deleteDoc(selectedDoc.id)}
          onExportToCalendar={() => exportDocToICS(selectedDoc)}
          onUpdateCategory={updateDocCategory}
        />
      )}

      {deadlineEditDocId && (() => {
        const d = docs.find((x) => x.id === deadlineEditDocId);
        if (!d) return null;
        return (
          <DeadlineEditModal
            doc={d}
            onCancel={() => setDeadlineEditDocId(null)}
            onSave={saveDeadlineEdit}
          />
        );
      })()}

      {manualDeadlineFormOpen && (
        <ManualDeadlineFormModal
          googleConnected={googleConnected}
          googleAutoExport={googleAutoExport}
          existingCategories={existingCategories}
          onCancel={() => setManualDeadlineFormOpen(false)}
          onSave={saveManualDeadline}
        />
      )}

      {selectedReminderId && !reminderFormOpen && (() => {
        const r = reminders.find((x) => x.id === selectedReminderId);
        if (!r) return null;
        const linkedDoc = r.docId ? docs.find((x) => x.id === r.docId) : null;
        return (
          <ReminderDetailModal
            reminder={r}
            doc={linkedDoc}
            onClose={() => setSelectedReminderId(null)}
            onEdit={openEditReminder}
            onDelete={deleteReminder}
            onToggleDone={toggleSelectedReminderDone}
            onExportToCalendar={() => exportReminderToICS(r)}
            onOpenDoc={(id) => {
              setSelectedReminderId(null);
              setSelectedId(id);
            }}
          />
        );
      })()}

      {reminderFormOpen && (
        <ReminderFormModal
          initial={
            reminderFormMode === "edit"
              ? reminders.find((r) => r.id === selectedReminderId)
              : reminderFormPrefill
          }
          docs={docs}
          googleConnected={googleConnected}
          googleAutoExport={googleAutoExport}
          onCancel={closeReminderForm}
          onSave={saveReminder}
        />
      )}

      {appealDocId && (() => {
        const d = docs.find((x) => x.id === appealDocId);
        if (!d) return null;
        return (
          <AppealModal
            doc={d}
            apiBase={API_BASE}
            accessToken={session?.access_token}
            onClose={() => setAppealDocId(null)}
            onScheduleReminder={handleAppealScheduleReminder}
            onShowReplyDraft={handleAppealShowReplyDraft}
            onQuotaExceeded={() => {
              setAppealDocId(null);
              openUpsell("appeal");
            }}
          />
        );
      })()}

      {selectedEventId && !eventFormOpen && (() => {
        const e = events.find((x) => x.id === selectedEventId);
        if (!e) return null;
        const c = e.contactId ? contacts.find((x) => x.id === e.contactId) : null;
        return (
          <EventDetailModal
            event={e}
            contact={c}
            onClose={() => setSelectedEventId(null)}
            onEdit={openEditEvent}
            onDelete={deleteEvent}
            onExportToCalendar={() => exportEventToICS(e)}
          />
        );
      })()}

      {eventFormOpen && (
        <EventFormModal
          initial={
            eventFormMode === "edit"
              ? events.find((e) => e.id === selectedEventId)
              : eventFormPrefill
          }
          contacts={contacts}
          googleConnected={googleConnected}
          googleAutoExport={googleAutoExport}
          onCancel={closeEventForm}
          onSave={saveEvent}
        />
      )}

      {selectedContactId && !contactFormOpen && (() => {
        const c = contacts.find((x) => x.id === selectedContactId);
        if (!c) return null;
        return (
          <ContactDetailModal
            contact={c}
            docs={docs}
            onClose={() => setSelectedContactId(null)}
            onEdit={() => {
              setContactFormMode("edit");
              setContactFormOpen(true);
            }}
            onDelete={deleteContact}
          />
        );
      })()}

      {contactFormOpen && (
        <ContactFormModal
          initial={
            contactFormMode === "edit"
              ? contacts.find((c) => c.id === selectedContactId)
              : contactFormPrefill
          }
          onCancel={closeContactForm}
          onSave={saveContact}
        />
      )}

      {pendingResult && !contactFormOpen && (
        <PostScanModal
          result={pendingResult}
          isFirstScan={!tooltipsSeen.has("first_scan_done")}
          existingCategories={existingCategories}
          categoryPrefill={scanCategoryPrefill}
          onConfirm={handlePostScanConfirm}
          onSkip={handlePostScanSkip}
        />
      )}

      {templateFormType && (
        <TemplateFormModal
          templateType={templateFormType}
          contacts={contacts}
          docs={docs}
          defaultSenderName={userName}
          onSubmit={submitTemplateRequest}
          onCancel={() => setTemplateFormType(null)}
        />
      )}

      {templateResult && (
        <TemplateResultModal
          result={templateResult}
          existingCategories={existingCategories}
          onClose={() => setTemplateResult(null)}
          onSaveAsDoc={saveTemplateAsDoc}
          onSaveAsTemplate={saveResultAsTemplate}
        />
      )}

      {searchOpen && (
        <SearchModal
          docs={docs}
          contacts={contacts}
          reminders={reminders}
          events={events}
          fileIndex={fileIndex}
          showTip={!tooltipsSeen.has("search")}
          onDismissTip={() => markTooltipSeen("search")}
          onClose={() => setSearchOpen(false)}
          onOpenDoc={setSelectedId}
          onOpenContact={setSelectedContactId}
          onOpenReminder={setSelectedReminderId}
          onOpenEvent={setSelectedEventId}
          onOpenLocalFile={openLocalFile}
        />
      )}

      {migrationPrompt && (
        <MigrationPromptModal
          counts={migrationPrompt.counts}
          busy={migrationBusy}
          onConfirm={migrateLegacyData}
          onSkip={skipMigration}
        />
      )}

      {installPromptEvent && !installDismissed && (
        <div className="install-banner" role="dialog" aria-labelledby="install-title">
          <div className="install-banner-body">
            <div className="install-banner-title" id="install-title">
              Büro auf dem Homescreen
            </div>
            <div className="install-banner-sub">
              Installier Büro als App — schneller Zugriff ohne Browser-Tab.
            </div>
          </div>
          <div className="install-banner-actions">
            <button
              type="button"
              className="btn-secondary btn-primary-sm"
              onClick={dismissInstallBanner}
            >
              Später
            </button>
            <button
              type="button"
              className="btn-primary btn-primary-sm"
              onClick={handleInstallClick}
            >
              Installieren
            </button>
          </div>
        </div>
      )}

      {successToast && (
        <SuccessToast
          message={successToast}
          onDone={() => setSuccessToast(null)}
        />
      )}

      {tarifIntroOpen && <TarifOnboardingModal onClose={closeTarifIntro} />}

      {upsellAction && (
        <UpsellModal
          action={upsellAction}
          onClose={closeUpsell}
          onOpenShop={goToShopFromUpsell}
        />
      )}

      {syncError && (
        <div className="sync-error-toast" role="alert">
          <div className="sync-error-body">
            <strong>Sync-Fehler ({syncError.table})</strong>
            <div>{syncError.message}</div>
            {syncError.hint && (
              <div className="sync-error-hint">{syncError.hint}</div>
            )}
          </div>
          <button
            type="button"
            className="sync-error-close"
            onClick={() => setSyncError(null)}
            aria-label="Schließen"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
