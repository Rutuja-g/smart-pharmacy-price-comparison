/**
 * Category controller.
 *
 * Handles admin management of medicine categories (list, add, edit).
 *
 * Categories are only ever added or edited — never deleted — because
 * the medicines table has a foreign key referencing categories. Deleting
 * a category could break that relationship.
 *
 * All routes in this controller are protected by `protectAdmin`, so only
 * users with the 'admin' role can manage categories.
 */

const Category = require("../models/Category");
const Medicine = require("../models/Medicine");
const {
  normalizeMedicineName,
  isValidCategoryName,
  isValidDescription,
  parsePositiveInt,
} = require("../utils/validation");

/**
 * Build the list of categories augmented with their active-medicine counts.
 * Shared by the list page and the "add category" form re-render path so the
 * count-map logic is not duplicated.
 * @returns {Promise<Array>} [{ id, name, description, medicine_count }]
 */
async function buildCategoriesWithCounts() {
  const categories = await Category.findAll();
  const counts = await Medicine.countByCategory();

  const countMap = {};
  counts.forEach((row) => {
    countMap[row.category_id] = row.medicine_count;
  });

  return categories.map((cat) => ({
    ...cat,
    medicine_count: countMap[cat.id] || 0,
  }));
}

/**
 * GET /admin/categories
 * List all categories with an active medicine count and an add form.
 */
async function getCategories(req, res) {
  try {
    const viewCategories = await buildCategoriesWithCounts();
    res.render("category/list", {
      title: "Manage Categories",
      appName: "Smart Pharmacy Price Comparison",
      categories: viewCategories,
      values: {},
      errors: {},
    });
  } catch (err) {
    console.error("List categories error:", err);
    req.flash("error", "Could not load categories. Please try again.");
    return res.redirect("/admin/medicines");
  }
}

/**
 * POST /admin/categories
 * Handle the "add category" form submission.
 */
async function postAddCategory(req, res) {
  const values = {
    name: normalizeMedicineName(req.body.name),
    description: String(req.body.description || "").trim(),
  };

  const errors = {};

  if (!isValidCategoryName(values.name)) {
    errors.name = "Category name is required (2-100 characters).";
  }
  if (!isValidDescription(values.description)) {
    errors.description = "Description must be 255 characters or fewer.";
  }

  const renderAddCategory = async () => {
    const viewCategories = await buildCategoriesWithCounts();
    return res.status(400).render("category/list", {
      title: "Manage Categories",
      appName: "Smart Pharmacy Price Comparison",
      categories: viewCategories,
      values,
      errors,
    });
  };

  if (Object.keys(errors).length > 0) {
    return renderAddCategory();
  }

  try {
    // Enforce unique category name (case-insensitive via DB unique key).
    const existing = await Category.findByName(values.name);
    if (existing) {
      errors.name = "A category with this name already exists.";
      return renderAddCategory();
    }

    await Category.create(values);
    req.flash("success", `Category "${values.name}" was added successfully.`);
    return res.redirect("/admin/categories");
  } catch (err) {
    console.error("Add category error:", err);
    req.flash(
      "error",
      "Something went wrong while adding the category. Please try again.",
    );
    return res.redirect("/admin/categories");
  }
}

/**
 * GET /admin/categories/:id/edit
 * Show the "edit category" form pre-filled with existing data.
 */
async function getEditCategory(req, res) {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    req.flash("error", "Invalid category.");
    return res.redirect("/admin/categories");
  }

  try {
    const category = await Category.findById(id);
    if (!category) {
      req.flash("error", "That category does not exist.");
      return res.redirect("/admin/categories");
    }

    res.render("category/edit", {
      title: `Edit: ${category.name}`,
      appName: "Smart Pharmacy Price Comparison",
      category,
      values: {
        name: category.name,
        description: category.description || "",
      },
      errors: {},
    });
  } catch (err) {
    console.error("Edit category form error:", err);
    req.flash(
      "error",
      "Could not load that category for editing. Please try again.",
    );
    return res.redirect("/admin/categories");
  }
}

/**
 * POST /admin/categories/:id/edit
 * Handle the "edit category" form submission.
 */
async function postEditCategory(req, res) {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    req.flash("error", "Invalid category.");
    return res.redirect("/admin/categories");
  }

  const values = {
    name: normalizeMedicineName(req.body.name),
    description: String(req.body.description || "").trim(),
  };

  const errors = {};

  if (!isValidCategoryName(values.name)) {
    errors.name = "Category name is required (2-100 characters).";
  }
  if (!isValidDescription(values.description)) {
    errors.description = "Description must be 255 characters or fewer.";
  }

  const renderEdit = (statusCode) => {
    return res.status(statusCode).render("category/edit", {
      title: "Edit Category",
      appName: "Smart Pharmacy Price Comparison",
      category: { id },
      values,
      errors,
    });
  };

  if (Object.keys(errors).length > 0) {
    return renderEdit(400);
  }

  try {
    const existing = await Category.findById(id);
    if (!existing) {
      req.flash("error", "That category does not exist.");
      return res.redirect("/admin/categories");
    }

    // Enforce unique name, excluding the current category being edited.
    const duplicate = await Category.findByName(values.name, id);
    if (duplicate) {
      errors.name = "A category with this name already exists.";
      return renderEdit(400);
    }

    await Category.update(id, values);
    req.flash("success", `Category "${values.name}" was updated successfully.`);
    return res.redirect("/admin/categories");
  } catch (err) {
    console.error("Edit category error:", err);
    req.flash(
      "error",
      "Something went wrong while updating the category. Please try again.",
    );
    return res.redirect(`/admin/categories/${id}/edit`);
  }
}

/**
 * GET /categories
 * Public category browsing page. Shows all categories with the number
 * of active medicines in each. Links to each category's medicine list.
 */
async function browseCategories(req, res) {
  try {
    const categories = await Category.findActiveWithCounts();
    res.render("category/browse", {
      title: "Browse Categories",
      appName: "Smart Pharmacy Price Comparison",
      categories,
    });
  } catch (err) {
    console.error("Browse categories error:", err);
    req.flash("error", "Could not load categories. Please try again.");
    return res.redirect("/");
  }
}

module.exports = {
  getCategories,
  postAddCategory,
  getEditCategory,
  postEditCategory,
  browseCategories,
};
