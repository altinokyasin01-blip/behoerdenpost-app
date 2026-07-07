const { createClient } = require("@supabase/supabase-js");

// TEMP DEBUG — checking why Railway crashes with "supabaseUrl is required"
// despite the vars appearing set in the dashboard. Logs presence/length
// only, never the actual secret value.
console.log("[requireAuth] SUPABASE_URL set:", !!process.env.SUPABASE_URL, "length:", (process.env.SUPABASE_URL || "").length);
console.log("[requireAuth] SUPABASE_ANON_KEY set:", !!process.env.SUPABASE_ANON_KEY, "length:", (process.env.SUPABASE_ANON_KEY || "").length);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Verifies the caller's Supabase session by asking Supabase's own Auth API
// (rather than checking the JWT signature locally) — this correctly rejects
// a token the user has since signed out of, not just an expired one.
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
  req.userId = data.user.id;
  next();
}

module.exports = requireAuth;
