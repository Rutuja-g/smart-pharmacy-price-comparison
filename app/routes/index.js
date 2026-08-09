/**
 * Application routes (index).
 *
 * This router aggregates the top-level routes. In this initial phase it
 * only contains the home page. Future modules (auth, medicines, admin, etc.)
 * will add their own routers and be mounted here.
 */

const express = require("express");
const homeController = require("../controllers/homeController");
const authRoutes = require("./auth");
const medicineRoutes = require("./medicine");
const categoryRoutes = require("./category");
const wishlistRoutes = require("./wishlist");
const pharmacyDashboardRoutes = require("./pharmacyDashboard");
const adminDashboardRoutes = require("./admin");

const router = express.Router();

// GET /
router.get("/", homeController.renderHome);

// Authentication routes (register, login, logout, profile)
router.use("/", authRoutes);

// Admin dashboard routes (protected - admin).
// Mounted BEFORE the medicine router so that /admin (and its sub-paths)
// are not captured by the medicine router's GET /medicines/:id route.
router.use("/admin", adminDashboardRoutes);

// Medicine routes (public browse + admin management)
router.use("/", medicineRoutes);

// Category routes (admin management)
router.use("/", categoryRoutes);

// Wishlist routes (protected - requireAuth)
router.use("/", wishlistRoutes);

// Pharmacy dashboard routes (protected - pharmacy_owner)
router.use("/", pharmacyDashboardRoutes);

module.exports = router;
