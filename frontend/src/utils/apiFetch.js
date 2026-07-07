// Thin wrapper around fetch() that attaches the Supabase access token as a
// Bearer Authorization header — every backend route now requires it. One
// central place so future routes/call-sites don't each reinvent this.
export function authFetch(url, options = {}, accessToken) {
  const headers = { ...(options.headers || {}) };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(url, { ...options, headers });
}
