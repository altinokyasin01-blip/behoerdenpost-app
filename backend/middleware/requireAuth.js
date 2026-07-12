const { createClient } = require("@supabase/supabase-js");

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
  // Stashed for downstream middleware (e.g. quota checks) that need to call
  // Supabase RPCs scoped to this user's own JWT, so auth.uid() resolves
  // correctly on the Postgres side — the anon key alone doesn't carry it.
  req.accessToken = token;
  next();
}

module.exports = requireAuth;
