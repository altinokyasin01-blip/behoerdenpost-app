const { createClient } = require("@supabase/supabase-js");
const { getClient } = require("../services/stripe");

// Plain Anon-Key-Client, kein User-JWT — ein Stripe-Webhook hat keinen
// eingeloggten Nutzer. Die drei apply_stripe_*-RPCs sind genau dafür an
// die anon-Rolle gegrantet und selbst secret-gated (siehe Migration).
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const RPC_SECRET = process.env.STRIPE_WEBHOOK_RPC_SECRET;
const CREDIT_PACK_AMOUNT = 15;

// Best-effort: eine fehlgeschlagene Log-Schreibung darf die Webhook-Antwort
// an Stripe nicht kippen -- nur zusätzlich zu console.error, nie statt dessen.
async function logWebhookFailure(eventId, eventType, detail) {
  try {
    const { error } = await supabase.rpc("log_webhook_failure", {
      p_webhook_secret: RPC_SECRET,
      p_event_id: eventId || null,
      p_event_type: eventType,
      p_detail: detail,
    });
    if (error) console.error("log_webhook_failure RPC error:", error.message);
  } catch (err) {
    console.error("log_webhook_failure failed:", err.message);
  }
}

async function handleCheckoutCompleted(session, eventId) {
  const userId = session.client_reference_id;
  if (!userId) {
    console.error(
      "checkout.session.completed ohne client_reference_id — Session:",
      session.id
    );
    return;
  }

  if (session.mode === "subscription") {
    const { data, error } = await supabase.rpc("apply_stripe_subscription_started", {
      p_webhook_secret: RPC_SECRET,
      p_user_id: userId,
      p_stripe_customer_id: session.customer,
      p_stripe_subscription_id: session.subscription,
      p_stripe_subscription_status: "active",
    });
    if (error) throw error;
    if (!data?.updated) {
      console.error("apply_stripe_subscription_started traf keine Zeile — user_id:", userId);
      await logWebhookFailure(
        eventId,
        "checkout.session.completed(subscription)",
        `apply_stripe_subscription_started traf keine Zeile — user_id: ${userId}`
      );
    }
  } else if (session.mode === "payment") {
    // p_event_id sorgt für Idempotenz: bei doppelter Stripe-Zustellung
    // desselben Events werden die Credits NICHT ein zweites Mal gutgeschrieben
    // (Dedup läuft atomar in der RPC).
    const { data, error } = await supabase.rpc("apply_stripe_credits_purchased", {
      p_webhook_secret: RPC_SECRET,
      p_user_id: userId,
      p_credits: CREDIT_PACK_AMOUNT,
      p_event_id: eventId,
    });
    if (error) throw error;
    if (data?.duplicate) {
      console.log("apply_stripe_credits_purchased: Duplikat ignoriert — event:", eventId);
    } else if (!data?.updated) {
      console.error("apply_stripe_credits_purchased traf keine Zeile — user_id:", userId);
      await logWebhookFailure(
        eventId,
        "checkout.session.completed(payment)",
        `apply_stripe_credits_purchased traf keine Zeile — user_id: ${userId}`
      );
    }
  }
}

async function handleSubscriptionStatus(subscription, status, eventId) {
  const { data, error } = await supabase.rpc("apply_stripe_subscription_status", {
    p_webhook_secret: RPC_SECRET,
    p_stripe_subscription_id: subscription.id,
    p_stripe_subscription_status: status,
  });
  if (error) throw error;
  if (!data?.updated) {
    console.error(
      "apply_stripe_subscription_status traf keine Zeile — subscription_id:",
      subscription.id
    );
    await logWebhookFailure(
      eventId,
      `customer.subscription.* (${status})`,
      `apply_stripe_subscription_status traf keine Zeile — subscription_id: ${subscription.id}`
    );
  }
}

// Kein requireAuth (Stripe schickt kein User-JWT). req.body ist hier ein
// roher Buffer, nicht durch express.json() geparst — siehe Mounting in
// index.js, das express.raw() für exakt diesen Pfad VOR dem globalen
// express.json() registriert. constructEvent() braucht genau diese
// unveränderten Bytes für die Signaturprüfung.
async function stripeWebhookHandler(req, res) {
  const stripe = getClient();
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return res.status(400).json({ error: "Webhook signature verification failed" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object, event.id);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionStatus(event.data.object, event.data.object.status, event.id);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionStatus(event.data.object, "canceled", event.id);
        break;
      default:
        // Andere Event-Typen bewusst ignoriert.
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook handling failed:", err);
    res.status(500).json({ error: "Webhook handling failed" });
  }
}

module.exports = stripeWebhookHandler;
