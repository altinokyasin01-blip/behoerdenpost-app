export const STORAGE_KEY = "buero_docs";
export const DISCLAIMER_KEY = "buero_disclaimer_shown";
export const ONBOARDING_KEY = "buero_onboarding_done";
export const EMAIL_KEY = "buero_user_email";
export const CONTACTS_KEY = "buero_contacts";
export const REMINDERS_KEY = "buero_reminders";
export const EVENTS_KEY = "buero_events";

const LEGACY_KEY_MAP = {
  buero_docs: "behoerdenpost_docs",
  buero_contacts: "behoerdenpost_contacts",
  buero_reminders: "behoerdenpost_reminders",
  buero_events: "behoerdenpost_events",
  buero_disclaimer_shown: "disclaimer_shown",
  buero_onboarding_done: "onboarding_done",
  buero_user_email: "user_email",
};

(function migrateLegacyKeys() {
  if (typeof localStorage === "undefined") return;
  for (const [newKey, oldKey] of Object.entries(LEGACY_KEY_MAP)) {
    try {
      const existing = localStorage.getItem(newKey);
      const legacy = localStorage.getItem(oldKey);
      if (existing === null && legacy !== null) {
        localStorage.setItem(newKey, legacy);
      }
      if (legacy !== null) {
        localStorage.removeItem(oldKey);
      }
    } catch {
      // ignore per-key migration failures
    }
  }
})();

export const THEME_KEY = "buero_theme";
export const THEME_CHOICES = ["system", "light", "dark"];
export const THEME_LABEL = { system: "System", light: "Hell", dark: "Dunkel" };

export const USER_NAME_KEY = "buero_user_name";
export const TIPS_SEEN_KEY = "buero_tips_seen";
export const INSTALL_DISMISSED_KEY = "buero_install_dismissed";
export const BROWSER_TIP_SEEN_KEY = "buero_browser_tip_seen";

export const BROWSER_TIP_TEXT =
  "Einige Funktionen wie der lokale Datei-Zugriff sind nur in Chrome und Edge verfügbar. Alle anderen Funktionen laufen in jedem Browser.";

(function migrateTipsSeen() {
  if (typeof localStorage === "undefined") return;
  try {
    if (localStorage.getItem(TIPS_SEEN_KEY) !== null) return;
    const oldRaw = localStorage.getItem("buero_tooltips_seen");
    if (!oldRaw) return;
    const parsed = JSON.parse(oldRaw);
    if (!Array.isArray(parsed)) return;
    const migrated = parsed.map((id) =>
      typeof id === "string" && id.startsWith("tab_") ? id.slice(4) : id
    );
    localStorage.setItem(TIPS_SEEN_KEY, JSON.stringify(migrated));
    localStorage.removeItem("buero_tooltips_seen");
  } catch {
    // ignore
  }
})();

export function loadBoolPref(key, defaultValue) {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return defaultValue;
    return v === "1";
  } catch {
    return defaultValue;
  }
}

const INITIAL_DOCS = [];

export function loadContacts() {
  try {
    const raw = localStorage.getItem(CONTACTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // corrupted / unavailable — fall through
  }
  return [];
}

export function loadReminders() {
  try {
    const raw = localStorage.getItem(REMINDERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function loadEvents() {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function loadDocs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // corrupted / unavailable — fall through
  }
  return INITIAL_DOCS;
}

export function loadDisclaimerOpen() {
  try {
    return !localStorage.getItem(DISCLAIMER_KEY);
  } catch {
    return false;
  }
}

export function loadOnboardingDone() {
  try {
    return !!localStorage.getItem(ONBOARDING_KEY);
  } catch {
    return true;
  }
}

export function loadUserEmail() {
  try {
    return localStorage.getItem(EMAIL_KEY) || "";
  } catch {
    return "";
  }
}

export function loadTooltipsSeen() {
  try {
    const raw = localStorage.getItem(TIPS_SEEN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {
    // ignore
  }
  return new Set();
}
