/**
 * Admin Dashboard routes (Phase 10).
 *
 * ALL routes are protected by `protectAdmin`, so only users with role
 * 'admin' can access them. Normal users and pharmacy owners are redirected.
 *
 *   GET  /admin                       - redirect to /admin/dashboard
 *   GET  /admin/dashboard             - summary metrics
 *
 *   GET  /admin/users                 - list users
 *   POST /admin/users/:id/deactivate  - deactivate a user
 *   POST /admin/users/:id/activate    - activate a user
 *
 *   GET  /admin/pharmacies            - list pharmacies
 *   GET  /admin/pharmacies/add        - add pharmacy form
 *   POST /admin/pharmacies            - create pharmacy
 *   GET  /admin/pharmacies/:id/edit   - edit pharmacy form
 *   POST /admin/pharmacies/:id/edit   - update pharmacy (incl. owner)
 *   POST /admin/pharmacies/:id/:status - set pharmacy status
 *       where :status is active | inactive | pending
 *
 * Existing medicine/category admin routes live in ./medicine and ./category
 * and are also protected by protectAdmin; they remain fully functional.
 */

const express = require("express");
const adminController = require("../controllers/adminController");
const { protectAdmin } = require("../middleware/auth");

const router = express.Router();

// Dashboard
router.get("/", (req, res) => res.redirect("/admin/dashboard"));
router.get("/dashboard", protectAdmin, adminController.getDashboard);

// User management (admin only)
router.get("/users", protectAdmin, adminController.getUsers);
router.post(
  "/users/:id/deactivate",
  protectAdmin,
  adminController.postDeactivateUser,
);
router.post(
  "/users/:id/activate",
  protectAdmin,
  adminController.postActivateUser,
);

// Pharmacy management (admin only)
router.get("/pharmacies", protectAdmin, adminController.getPharmacies);
router.get("/pharmacies/add", protectAdmin, adminController.getAddPharmacy);
router.post("/pharmacies", protectAdmin, adminController.postAddPharmacy);
router.get(
  "/pharmacies/:id/edit",
  protectAdmin,
  adminController.getEditPharmacy,
);
router.post(
  "/pharmacies/:id/edit",
  protectAdmin,
  adminController.postEditPharmacy,
);
router.post(
  "/pharmacies/:id/:status",
  protectAdmin,
  adminController.postSetPharmacyStatus,
);

module.exports = router;
