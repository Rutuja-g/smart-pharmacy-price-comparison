/**
 * Pharmacy Dashboard routes.
 *
 * All routes are protected by `protectPharmacyDashboard`, so only users with
 * role 'pharmacy_owner' can access them. Ownership of the selected pharmacy
 * is verified server-side in the controller (never trusted from the browser).
 *
 *   GET  /pharmacy/dashboard                   - dashboard summary
 *   GET  /pharmacy/inventory                   - view/search/filter inventory
 *   GET  /pharmacy/inventory/add               - add inventory form
 *   POST /pharmacy/inventory                   - add inventory
 *   POST /pharmacy/inventory/:id/stock         - update stock (+ availability)
 *   POST /pharmacy/inventory/:id/price         - update price
 *   POST /pharmacy/inventory/:id/availability  - toggle availability
 */

const express = require("express");
const pharmacyDashboardController = require("../controllers/pharmacyDashboardController");
const { protectPharmacyDashboard } = require("../middleware/auth");

const router = express.Router();

// Dashboard & inventory views (protected)
router.get(
  "/pharmacy/dashboard",
  protectPharmacyDashboard,
  pharmacyDashboardController.getDashboard,
);
router.get(
  "/pharmacy/inventory",
  protectPharmacyDashboard,
  pharmacyDashboardController.getInventory,
);
router.get(
  "/pharmacy/inventory/add",
  protectPharmacyDashboard,
  pharmacyDashboardController.getAddInventory,
);

// Inventory mutations (protected)
router.post(
  "/pharmacy/inventory",
  protectPharmacyDashboard,
  pharmacyDashboardController.postAddInventory,
);
router.post(
  "/pharmacy/inventory/:id/stock",
  protectPharmacyDashboard,
  pharmacyDashboardController.postUpdateStock,
);
router.post(
  "/pharmacy/inventory/:id/price",
  protectPharmacyDashboard,
  pharmacyDashboardController.postUpdatePrice,
);
router.post(
  "/pharmacy/inventory/:id/availability",
  protectPharmacyDashboard,
  pharmacyDashboardController.postToggleAvailability,
);

module.exports = router;
