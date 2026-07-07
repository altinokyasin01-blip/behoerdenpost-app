const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const FIFTEEN_MIN = 15 * 60 * 1000;

// First line of defense, mounted before requireAuth — catches unauthenticated
// flood attempts cheaply, before they even reach the Supabase auth-check
// network round-trip.
const ipRateLimit = rateLimit({
  windowMs: FIFTEEN_MIN,
  limit: 80,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP, please try again later." },
});

// Tighter, per-account budget — mounted after requireAuth so req.userId is
// available. Stops a single account from exhausting the shared API budget,
// independent of how many different IPs it's used from.
const userRateLimit = rateLimit({
  windowMs: FIFTEEN_MIN,
  limit: 25,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || ipKeyGenerator(req.ip),
  message: { error: "Too many requests for this account, please try again later." },
});

module.exports = { ipRateLimit, userRateLimit };
