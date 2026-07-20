const express = require("express");
const { supabaseAsUser } = require("../middleware/quota");
const { getClient } = require("../services/stripe");

const router = express.Router();

router.get("/status", async (req, res, next) => {
  try {
    const supabase = supabaseAsUser(req.accessToken);
    const { data, error } = await supabase.rpc("get_billing_status");
    if (error) return next(error);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// Price-IDs kommen aus Env-Vars statt hartcodiert — unterscheiden sich
// zwischen Test-/Live-Mode und sind Stripe-Kontokonfiguration, kein Code.
const CHECKOUT_CONFIG = {
  subscription: { mode: "subscription", priceEnvVar: "STRIPE_PRICE_SMART_MONTHLY" },
  credits: { mode: "payment", priceEnvVar: "STRIPE_PRICE_CREDIT_PACK" },
};

router.post("/checkout", async (req, res, next) => {
  try {
    const { type } = req.body || {};
    const config = CHECKOUT_CONFIG[type];
    if (!config) {
      return res.status(400).json({ error: "type must be 'subscription' or 'credits'" });
    }
    const priceId = process.env[config.priceEnvVar];
    if (!priceId) {
      return res.status(500).json({ error: `${config.priceEnvVar} is not set` });
    }
    // FRONTEND_URL ist komma-getrennt (index.js nutzt die volle Liste als
    // CORS-Allowlist, z.B. Vercel-URL + eigene Domain) -- als Redirect-Ziel
    // ergibt aber nur EINE URL Sinn. Konvention: die erste Adresse der
    // Liste ist die kanonische, an die Stripe nach dem Checkout zurückleitet.
    const frontendUrl = (process.env.FRONTEND_URL || "").split(",")[0].trim();
    if (!frontendUrl) {
      return res.status(500).json({ error: "FRONTEND_URL is not set" });
    }

    const stripe = getClient();
    const session = await stripe.checkout.sessions.create({
      mode: config.mode,
      line_items: [{ price: priceId, quantity: 1 }],
      // Verknüpft die Session mit dem aufrufenden Nutzer — der Webhook
      // liest das später aus session.client_reference_id, um zu wissen,
      // wessen profiles-Zeile bei checkout.session.completed aktualisiert
      // werden muss.
      client_reference_id: req.userId,
      success_url: `${frontendUrl}/settings?billing=success`,
      cancel_url: `${frontendUrl}/settings?billing=cancel`,
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
