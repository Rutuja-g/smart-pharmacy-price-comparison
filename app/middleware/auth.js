/**
 * Authentication & authorization middleware.
 *
 * These functions protect routes based on the authenticated session.
 * They NEVER trust role values supplied by the client/browser; they
 * always read the role from the authenticated user record stored in
 * the session at login time.
 *
 * Roles used across the app (matching the users.role ENUM):
 *   - 'user'            : regular customer
 *   - 'pharmacy_owner'  : pharmacy admin (owns/manages a pharmacy)
 *   - 'admin'           : platform administrator
 */

const User = require("../models/User");

/**
 * Destroy the session for a deactivated account and redirect to login.
 * The DB is the source of truth for account status, so a deactivation
 * performed by an admin takes effect on the user's very next protected
 * request.
 * @param {Object} req
 * @param {Object} res
 */
function expireInactiveSession(req, res) {
  if (!req.session) {
    return res.redirect("/login");
  }
  req.session.regenerate((err) => {
    if (err) {
      console.error("Session expire regenerate error:", err);
    }
    req.flash(
      "error",
      "Your account has been deactivated. Please contact support.",
    );
    return res.redirect("/login");
  });
}

/**
 * Require an authenticated user.
 * If no valid session user, redirect to /login with a flash message.
 *
 * Even if a user already has a session, the account's status is checked
 * against the database. If the account was deactivated since login, the
 * session is invalidated so they can no longer access protected pages.
 */
async function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    try {
      const user = await User.findById(req.session.user.id);
      if (user && user.status === "active") {
        return next();
      }
      // Account missing or deactivated -> invalidate the session.
      return expireInactiveSession(req, res);
    } catch (err) {
      console.error("Auth check error:", err);
      return expireInactiveSession(req, res);
    }
  }
  req.flash("error", "You must be logged in to access that page.");
  return res.redirect("/login");
}

/**
 * Require one of the given roles.
 * Usage: router.get("/admin", requireRole("admin"), handler)
 *
 * @param  {...string} allowedRoles
 * @returns {Function} middleware
 */
function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    // Must be authenticated first.
    if (!req.session || !req.session.user) {
      req.flash("error", "You must be logged in to access that page.");
      return res.redirect("/login");
    }

    // Check the account is still active (DB is source of truth).
    try {
      const user = await User.findById(req.session.user.id);
      if (!user || user.status !== "active") {
        return expireInactiveSession(req, res);
      }
    } catch (err) {
      console.error("Role check user lookup error:", err);
      return expireInactiveSession(req, res);
    }

    const userRole = req.session.user.role;
    if (allowedRoles.includes(userRole)) {
      return next();
    }

    // Logged in but not authorized.
    req.flash("error", "You do not have permission to access that page.");
    return res.redirect("/");
  };
}

/**
 * Protect routes that only the platform admin may access.
 */
function protectAdmin(req, res, next) {
  return requireRole("admin")(req, res, next);
}

/**
 * Protect pharmacy dashboard routes.
 * Only the pharmacy owner (pharmacy_admin role) may access these.
 */
function protectPharmacyDashboard(req, res, next) {
  return requireRole("pharmacy_owner")(req, res, next);
}

module.exports = {
  requireAuth,
  requireRole,
  protectAdmin,
  protectPharmacyDashboard,
};
