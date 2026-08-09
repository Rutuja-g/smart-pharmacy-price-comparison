/**
 * Wishlist routes.
 *
 * All routes are protected by `requireAuth`, so unauthenticated users are
 * redirected to /login with a flash message before any handler runs.
 *
 *   GET  /wishlist            - view the user's wishlist
 *   POST /wishlist/:id/add    - add a medicine to the wishlist
 *   POST /wishlist/:id/remove - remove a medicine from the wishlist
 */

const express = require("express");
const wishlistController = require("../controllers/wishlistController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// View the wishlist (protected)
router.get("/wishlist", requireAuth, wishlistController.getWishlist);

// Add a medicine to the wishlist (protected)
router.post("/wishlist/:id/add", requireAuth, wishlistController.addToWishlist);

// Remove a medicine from the wishlist (protected)
router.post(
  "/wishlist/:id/remove",
  requireAuth,
  wishlistController.removeFromWishlist,
);

module.exports = router;
