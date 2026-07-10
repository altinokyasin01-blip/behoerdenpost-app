import { loadScript } from "./loaders.js";

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar";
const GIS_URL = "https://accounts.google.com/gsi/client";
export const GOOGLE_TOKEN_KEY = "buero_google_token";
export const GOOGLE_AUTO_EXPORT_KEY = "buero_google_auto_export";
export const GOOGLE_SHOW_CALENDAR_KEY = "buero_google_show_calendar";
export const GOOGLE_CONFIGURED = !!GOOGLE_CLIENT_ID;
// Temporär: Google-Verknüpfung als "Coming soon" überdecken. Auf false
// setzen, um die Funktion wieder freizuschalten — Code, Token-Handling
// und UI dahinter bleiben vollständig erhalten.
export const GOOGLE_COMING_SOON = true;

let gisPromise = null;
function getGoogleOAuth2() {
  if (!gisPromise) {
    gisPromise = (async () => {
      await loadScript(GIS_URL);
      const api = window.google?.accounts?.oauth2;
      if (!api) throw new Error("Google Identity Services not available");
      return api;
    })().catch((e) => {
      gisPromise = null;
      throw e;
    });
  }
  return gisPromise;
}

export function googleSignIn() {
  if (!GOOGLE_CONFIGURED) {
    return Promise.reject(new Error("Google Client-ID nicht konfiguriert"));
  }
  return new Promise((resolve, reject) => {
    getGoogleOAuth2()
      .then((oauth2) => {
        const client = oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: GOOGLE_SCOPE,
          callback: (resp) => {
            if (resp.error) {
              reject(new Error(resp.error_description || resp.error));
              return;
            }
            const expiresIn = Number(resp.expires_in) || 3600;
            resolve({
              accessToken: resp.access_token,
              expiresAt: Date.now() + (expiresIn - 60) * 1000,
            });
          },
          error_callback: (err) =>
            reject(new Error(err.type || "authorization_failed")),
        });
        client.requestAccessToken({ prompt: "" });
      })
      .catch(reject);
  });
}

export function googleRevoke(token) {
  if (!token) return Promise.resolve();
  return getGoogleOAuth2()
    .then((oauth2) => {
      return new Promise((resolve) => {
        oauth2.revoke(token, () => resolve());
      });
    })
    .catch(() => {});
}

export async function googleCreateEvent(accessToken, googleEvent) {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(googleEvent),
    }
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error("token_expired");
    throw new Error(data.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function googleListEvents(accessToken, timeMin, timeMax) {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "150",
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    if (res.status === 401) throw new Error("token_expired");
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export function loadGoogleToken() {
  try {
    const raw = localStorage.getItem(GOOGLE_TOKEN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.accessToken === "string" && parsed.expiresAt) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return null;
}
