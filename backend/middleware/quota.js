const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

// Per-request Supabase client scoped to the caller's own JWT — required so
// that auth.uid() resolves correctly inside the RPC functions on the
// Postgres side. The anon key alone (as used by requireAuth for verifying
// the token) does not carry the caller's identity into row-level security
// or the SECURITY DEFINER quota functions.
function supabaseAsUser(accessToken) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

// Deterministic content hash used as the idempotency key for consumeQuota
// (scan/template). Computed server-side from the request content itself
// (file bytes / QR text / template payload) — no frontend changes needed,
// and a retry of the exact same content naturally produces the same hash.
function hashContent(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

const HAS_QUOTA_RPC = {
  template: "has_template_quota",
  appeal: "has_appeal_quota",
  scan: "has_scan_quota",
};
const CONSUME_QUOTA_RPC = {
  template: "consume_template_credit",
  appeal: "consume_appeal_quota",
  scan: "consume_scan_credit",
};

// READ-ONLY quota peek — returns whether the caller has quota available,
// without consuming anything. Used both by the checkQuota middleware and
// directly inside routes that only need to gate a subset of requests (e.g.
// /api/qr, where a deterministic GiroCode needs no quota at all).
async function hasQuota(action, accessToken) {
  const rpcName = HAS_QUOTA_RPC[action] || HAS_QUOTA_RPC.scan;
  const supabase = supabaseAsUser(accessToken);
  const { data, error } = await supabase.rpc(rpcName);
  if (error) throw error;
  return !!data?.allowed;
}

// Gates document scans (/api/analyze) and template creation (/api/template)
// against the caller's quota. This is a READ-ONLY peek that runs BEFORE the
// Claude API call, so an over-limit request never reaches (and never pays
// for) Claude — but it does NOT consume anything yet. The actual consumption
// happens via consumeQuota() AFTER a successful Claude call, so a failed
// analysis doesn't burn a scan/credit.
//
// NOTE: /api/qr does NOT use this middleware — it gates inside the route so
// that a deterministic GiroCode (no Claude call) is fully quota-free.
function checkQuota(action) {
  return async function (req, res, next) {
    try {
      if (!(await hasQuota(action, req.accessToken))) {
        return res.status(402).json({ error: "quota_exceeded" });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Consumes one unit of quota (free scan, then credit) AFTER the work
// succeeded. Called from the route handler once the Claude result is in
// hand. Best-effort: a failure here must not fail the already-successful
// request (the user got their result) — we log and move on. The peek in
// checkQuota already guaranteed availability for the common sequential
// case; a rare concurrent race could make this return allowed:false after
// the fact, which we just log (minor over-grant, never an over-charge).
//
// requestHash (optional, scan/template only): a server-computed content
// hash of the request (file bytes / QR text / template payload) passed
// through to the RPC as p_request_hash. A client retry of the SAME content
// within a short window is recognized as a duplicate and NOT consumed
// again — protects against double Credit-Abzug when a network timeout or
// double-submit causes the same logical action to reach the backend twice.
async function consumeQuota(action, accessToken, requestHash) {
  const rpcName = CONSUME_QUOTA_RPC[action] || CONSUME_QUOTA_RPC.scan;
  try {
    const supabase = supabaseAsUser(accessToken);
    const params = action === "appeal" ? {} : { p_request_hash: requestHash || null };
    const { data, error } = await supabase.rpc(rpcName, params);
    if (error) {
      console.error(`consumeQuota(${action}) RPC error:`, error.message);
    } else if (!data?.allowed) {
      console.warn(
        `consumeQuota(${action}) returned allowed:false after successful work — reason: ${data?.reason}`
      );
    }
  } catch (err) {
    console.error(`consumeQuota(${action}) failed:`, err.message);
  }
}

// Binary gate for Smart-only features (currently: Widerspruch-Analyse).
// A running trial counts as Smart-equivalent access.
function requireTier(tier) {
  const allowedTiers = tier === "smart" ? ["smart", "trial"] : [tier];
  return async function (req, res, next) {
    try {
      const supabase = supabaseAsUser(req.accessToken);
      const { data, error } = await supabase.rpc("get_billing_status");
      if (error) return next(error);
      if (!allowedTiers.includes(data?.tier)) {
        return res.status(402).json({
          error: "tier_required",
          requiredTier: tier,
          currentTier: data?.tier || "basic",
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { checkQuota, hasQuota, consumeQuota, requireTier, supabaseAsUser, hashContent };
