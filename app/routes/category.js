/**
 * Category routes.
 *
 * All routes are admin-only (protected by `protectAdmin`):
 *   GET  /admin/categories          - list categories + add form
 *   POST /admin/categories          - create a category
 *   GET  /admin/categories/:id/edit - show edit form
 *   POST /admin/categories/:id/edit - update a category
 *
 * Categories are never deleted (medicines reference them via FK).
 */

const express = require("express");
const categoryController = require("../controllers/categoryController");
const { protectAdmin } = require("../middleware/auth");

const router = express.Router();

// Public category browsing (list of categories with medicine counts).
router.get("/categories", categoryController.browseCategories);

// Admin-only category management routes.
router.get("/admin/categories", protectAdmin, categoryController.getCategories);
router.post(
  "/admin/categories",
  protectAdmin,
  categoryController.postAddCategory,
);
router.get(
  "/admin/categories/:id/edit",
  protectAdmin,
  categoryController.getEditCategory,
);
router.post(
  "/admin/categories/:id/edit",
  protectAdmin,
  categoryController.postEditCategory,
);

module.exports = router;
