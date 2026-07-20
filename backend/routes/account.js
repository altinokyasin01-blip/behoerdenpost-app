const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const { getClient: getStripeClient } = require("../services/stripe");
const { supabaseAsUser } = require("../middleware/quota");

const router = express.Router();

// Separater, streng zweckgebundener Admin-Client -- NUR für den einen Aufruf
// weiter unten (Auth-Account löschen) instanziiert, sonst nirgends im Code
// verwendet. Absichtlich NICHT in der globalen Startup-Validierung
// (backend/index.js) als Pflicht-Var gelistet: diese eine, selten genutzte
// Funktion darf nicht das gesamte Backend beim Start crashen lassen, falls
// der Key mal fehlt -- stattdessen lazy geprüft, Fehler bleibt auf diese
// Route beschränkt (gleiches Prinzip wie ANTHROPIC_API_KEY/STRIPE_SECRET_KEY
// vor der Startup-Härtung).
function getSupabaseAdmin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Löscht den aufrufenden Account vollständig: Stripe-Abo kündigen (falls
// vorhanden), alle Nutzerdaten, die profiles-Zeile, zuletzt den Auth-Account
// selbst. req.userId kommt ausschließlich aus dem verifizierten JWT
// (requireAuth) -- niemals aus dem Request-Body, ein Aufrufer kann also
// strukturell nur den eigenen Account löschen lassen.
//
// Reihenfolge ist bewusst so gewählt, dass ein Fehlschlag im
// spätestmöglichen Schritt (Auth-Account löschen) den erholbarsten Zustand
// hinterlässt: Daten/Abo/Profil sind bereits sauber weg, aber der Nutzer
// kann sich noch einloggen (statt umgekehrt für immer ausgesperrt bei
// verwaisten Daten). Jeder Fehlschlag bricht sofort ab und benennt exakt
// den Schritt -- nie ein stilles "erfolgreich".
router.delete("/", async (req, res) => {
  const supabase = supabaseAsUser(req.accessToken);
  let stripeCancelled = false;

  try {
    // Schritt 1: aktives Stripe-Abo sofort kündigen (kein cancel_at_period_end
    // -- der Account wird ohnehin komplett gelöscht, "Zugriff bis
    // Periodenende" ergibt ohne Account keinen Sinn. Keine anteilige
    // Rückerstattung; das reguläre 14-tägige Widerrufsrecht bleibt davon
    // unberührt und wird hier nicht automatisiert, sondern bliebe ein
    // manueller Support-Fall).
    const { data: profile, error: profileReadError } = await supabase
      .from("profiles")
      .select("stripe_subscription_id")
      .eq("id", req.userId)
      .maybeSingle();
    if (profileReadError) {
      console.error("Account-Löschung: Profil-Lesen fehlgeschlagen:", profileReadError.message);
      return res.status(500).json({ error: "read_profile_failed", step: "read_profile", stripeCancelled });
    }

    if (profile?.stripe_subscription_id) {
      try {
        const stripe = getStripeClient();
        await stripe.subscriptions.cancel(profile.stripe_subscription_id);
        stripeCancelled = true;
      } catch (err) {
        // Abo existiert bei Stripe schon nicht mehr (z.B. vorher manuell
        // gekündigt) -- kein echter Fehler, einfach weiter.
        if (err.code === "resource_missing") {
          stripeCancelled = true;
        } else {
          console.error("Account-Löschung: Stripe-Kündigung fehlgeschlagen:", err.message);
          return res.status(500).json({ error: "cancel_subscription_failed", step: "cancel_subscription", stripeCancelled });
        }
      }
    } else {
      stripeCancelled = true; // kein Abo vorhanden -- nichts zu kündigen
    }

    // Schritt 2: Nutzerdaten löschen -- gleiches Muster/gleiches
    // Fehlerabbruch-Verhalten wie deleteAllData im Frontend (Promise.all,
    // .error-Check statt nur geworfener Netzwerkfehler, kompletter Abbruch
    // bei jedem Fehlschlag).
    const results = await Promise.all([
      supabase.from("documents").delete().eq("user_id", req.userId),
      supabase.from("contacts").delete().eq("user_id", req.userId),
      supabase.from("reminders").delete().eq("user_id", req.userId),
      supabase.from("events").delete().eq("user_id", req.userId),
      supabase.from("saved_templates").delete().eq("user_id", req.userId),
    ]).catch((e) => {
      console.error("Account-Löschung: Datenlöschung (Netzwerk) fehlgeschlagen:", e.message);
      return null;
    });
    if (results === null || results.some((r) => r.error)) {
      results?.forEach((r) => r.error && console.error("Account-Löschung: Tabellen-Löschfehler:", r.error.message));
      return res.status(500).json({ error: "delete_data_failed", step: "delete_data", stripeCancelled });
    }

    // Schritt 3: profiles-Zeile löschen. `deleted:false` OHNE einen echten
    // RPC-Fehler heißt nur "Zeile existierte schon nicht" -- das ist bereits
    // der gewünschte Endzustand, kein Fehlschlag. Wichtig für Wiederholungs-
    // versuche: schlägt Schritt 4 (Auth-Löschung) fehl, ist die profiles-
    // Zeile zu diesem Zeitpunkt schon weg -- ein erneuter Versuch desselben
    // Nutzers muss hier durchlaufen können, statt für immer an Schritt 3
    // hängen zu bleiben, nur weil nichts mehr zum Löschen da ist.
    const { error: profileDeleteError } = await supabase.rpc("delete_own_profile");
    if (profileDeleteError) {
      console.error("Account-Löschung: profiles-Löschung fehlgeschlagen:", profileDeleteError.message);
      return res.status(500).json({ error: "delete_profile_failed", step: "delete_profile", stripeCancelled });
    }

    // Schritt 4: Auth-Account löschen -- absichtlich letzter Schritt, siehe
    // Kommentar oben. Braucht den Service-Role-Key (einziger Ort im Code).
    try {
      const admin = getSupabaseAdmin();
      const { error: authDeleteError } = await admin.auth.admin.deleteUser(req.userId);
      if (authDeleteError) {
        console.error("Account-Löschung: Auth-Account-Löschung fehlgeschlagen:", authDeleteError.message);
        return res.status(207).json({
          error: "delete_auth_failed",
          step: "delete_auth_account",
          stripeCancelled,
          dataDeleted: true,
        });
      }
    } catch (err) {
      console.error("Account-Löschung: Auth-Admin-Aufruf fehlgeschlagen:", err.message);
      return res.status(207).json({
        error: "delete_auth_failed",
        step: "delete_auth_account",
        stripeCancelled,
        dataDeleted: true,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Account-Löschung: unerwarteter Fehler:", err);
    res.status(500).json({ error: "unexpected_error", step: "unknown", stripeCancelled });
  }
});

module.exports = router;
