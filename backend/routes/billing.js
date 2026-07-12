const express = require("express");
const { supabaseAsUser } = require("../middleware/quota");

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

module.exports = router;
