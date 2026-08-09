/**
 * Wishlist controller.
 *
 * Handles viewing, adding to, and removing from the authenticated user's
 * wishlist. All routes are protected by the `requireAuth` middleware, so a
 * valid session is required before any handler runs. Every handler reads the
 * user id from the session (`req.session.user.id`) and NEVER from the request
 * body/query — a user can only ever operate on their own wishlist.
 */

const Wishlist = require("../models/Wishlist");
const Medicine = require("../models/Medicine");
const { parsePositiveInt } = require("../utils/validation");

/**
 * Helper: parse and validate a medicine id from the route param.
 * @param {string} raw
 * @returns {number|null} A positive integer, or null if invalid.
 */
const parseMedicineId = parsePositiveInt;

/**
 * GET /wishlist
 * Show the authenticated user's saved medicines.
 */
async function getWishlist(req, res) {
  try {
    const userId = req.session.user.id;
    const items = await Wishlist.findByUser(userId);

    res.render("wishlist", {
      title: "My Wishlist",
      appName: "Smart Pharmacy Price Comparison",
      items,
    });
  } catch (err) {
    console.error("Get wishlist error:", err);
    req.flash("error", "Could not load your wishlist. Please try again.");
    return res.redirect("/");
  }
}

/**
 * POST /wishlist/:id/add
 * Add a medicine to the authenticated user's wishlist.
 *
 * Validates the medicine id, confirms the medicine exists and is active,
 * then inserts the wishlist row. Duplicate adds are handled gracefully
 * (INSERT IGNORE + friendly message). Redirects back to the medicine detail.
 */
async function addToWishlist(req, res) {
  const medicineId = parseMedicineId(req.params.id);
  if (!medicineId) {
    req.flash("error", "Invalid medicine.");
    return res.redirect("/medicines");
  }

  try {
    const userId = req.session.user.id;

    // Confirm the medicine exists and is active before saving it.
    const medicine = await Medicine.findById(medicineId);
    if (!medicine || medicine.status !== "active") {
      req.flash("error", "That medicine does not exist or is unavailable.");
      return res.redirect("/medicines");
    }

    const inserted = await Wishlist.add(userId, medicineId);
    if (inserted) {
      req.flash("success", `"${medicine.name}" was added to your wishlist.`);
    } else {
      req.flash("info", `"${medicine.name}" is already in your wishlist.`);
    }

    return res.redirect(`/medicines/${medicineId}`);
  } catch (err) {
    console.error("Add to wishlist error:", err);
    req.flash("error", "Could not add that medicine. Please try again.");
    return res.redirect(`/medicines/${medicineId}`);
  }
}

/**
 * POST /wishlist/:id/remove
 * Remove a medicine from the authenticated user's wishlist.
 *
 * The delete is scoped to the session user's id and the medicine id, so only
 * the current user's entry can ever be removed. Redirects to the wishlist
 * page (and supports a `next` flag to return to the medicine detail).
 */
async function removeFromWishlist(req, res) {
  const medicineId = parseMedicineId(req.params.id);
  if (!medicineId) {
    req.flash("error", "Invalid medicine.");
    return res.redirect("/wishlist");
  }

  try {
    const userId = req.session.user.id;
    const removed = await Wishlist.remove(userId, medicineId);

    if (removed) {
      req.flash("success", "Medicine removed from your wishlist.");
    } else {
      req.flash("info", "That medicine was not in your wishlist.");
    }

    // If the request came from the medicine detail page, send the user back
    // there; otherwise return to the wishlist page.
    if (req.body.next === "medicine") {
      return res.redirect(`/medicines/${medicineId}`);
    }
    return res.redirect("/wishlist");
  } catch (err) {
    console.error("Remove from wishlist error:", err);
    req.flash("error", "Could not remove that medicine. Please try again.");
    return res.redirect("/wishlist");
  }
}

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
};
