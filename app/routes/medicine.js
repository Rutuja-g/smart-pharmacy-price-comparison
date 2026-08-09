/**
 * Medicine routes.
 *
 * Public routes:
 *   GET /medicines            - browse active medicines
 *   GET /medicines/:id        - view a single medicine's details
 *
 * Admin routes (all protected by `protectAdmin`):
 *   GET  /admin/medicines            - list all medicines (manage)
 *   GET  /admin/medicines/add        - show add form
 *   POST /admin/medicines            - create a medicine
 *   GET  /admin/medicines/:id/edit   - show edit form
 *   POST /admin/medicines/:id/edit   - update a medicine
 *   POST /admin/medicines/:id/deactivate - soft-deactivate (status=inactive)
 *   POST /admin/medicines/:id/activate   - re-activate (status=active)
 *
 * Only admin users can create, edit, or activate/deactivate medicines.
 */

const express = require("express");
const medicineController = require("../controllers/medicineController");
const { protectAdmin } = require("../middleware/auth");

const router = express.Router();

// ---- Public routes ----
router.get("/medicines", medicineController.listMedicines);
// IMPORTANT: /medicines/search must be declared BEFORE /medicines/:id so
// that "search" is not captured as a medicine id parameter.
router.get("/medicines/search", medicineController.searchMedicines);
router.get("/medicines/:id", medicineController.showMedicine);

// Public category browsing (medicines within a category).
// Mounted here so it can reuse the medicine controller's listByCategory.
router.get("/categories/:id", medicineController.listByCategory);

// ---- Admin routes ----
router.get(
  "/admin/medicines",
  protectAdmin,
  medicineController.getAdminMedicines,
);
router.get(
  "/admin/medicines/add",
  protectAdmin,
  medicineController.getAddMedicine,
);
router.post(
  "/admin/medicines",
  protectAdmin,
  medicineController.postAddMedicine,
);
router.get(
  "/admin/medicines/:id/edit",
  protectAdmin,
  medicineController.getEditMedicine,
);
router.post(
  "/admin/medicines/:id/edit",
  protectAdmin,
  medicineController.postEditMedicine,
);
router.post(
  "/admin/medicines/:id/deactivate",
  protectAdmin,
  medicineController.postDeactivate,
);
router.post(
  "/admin/medicines/:id/activate",
  protectAdmin,
  medicineController.postActivate,
);

module.exports = router;
