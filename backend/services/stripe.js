const Stripe = require("stripe");

let client = null;
function getClient() {
  if (!client) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    client = new Stripe(apiKey);
  }
  return client;
}

module.exports = { getClient };
