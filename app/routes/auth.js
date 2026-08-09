/**
 * Authentication routes.
 *
 * Public routes:
 *   GET  /register        - show registration form
 *   POST /register        - create a new account
 *   GET  /login           - show login form
 *   POST /login           - authenticate a user
 *   POST /logout          - destroy the session
 *
 * Protected route:
 *   GET  /profile         - show the logged-in user's profile (requireAuth)
 */

const express = require("express");
const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Registration
router.get("/register", authController.getRegister);
router.post("/register", authController.postRegister);

// Login
router.get("/login", authController.getLogin);
router.post("/login", authController.postLogin);

// Logout (POST only - avoids CSRF via simple GET logout)
router.post("/logout", authController.logout);

// Profile (protected)
router.get("/profile", requireAuth, authController.getProfile);

module.exports = router;
