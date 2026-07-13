const { createClient } = require("@supabase/supabase-js");

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

// Gates document scans (/api/analyze, /api/qr) and template creation
// (/api/template) against the caller's quota. This is a READ-ONLY peek that
// runs BEFORE the Claude API call, so an over-limit request never reaches
// (and never pays for) Claude — but it does NOT consume anything yet. The
// actual consumption happens via consumeQuota() AFTER a successful Claude
// call, so a failed analysis doesn't burn a scan/credit.
function checkQuota(action) {
  const rpcName =
    action === "template" ? "has_template_quota" : "has_scan_quota";
  return async function (req, res, next) {
    try {
      const supabase = supabaseAsUser(req.accessToken);
      const { data, error } = await supabase.rpc(rpcName);
      if (error) return next(error);
      if (!data?.allowed) {
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
async function consumeQuota(action, accessToken) {
  const rpcName =
    action === "template" ? "consume_template_credit" : "consume_scan_credit";
  try {
    const supabase = supabaseAsUser(accessToken);
    const { data, error } = await supabase.rpc(rpcName);
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

module.exports = { checkQuota, consumeQuota, requireTier, supabaseAsUser };
