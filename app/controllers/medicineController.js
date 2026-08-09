


/**
 * Medicine controller.
 *
 * Handles public medicine browsing (list + detail) and admin-only
 * CRUD + activation/deactivation of medicines.
 *
 * Authorization:
 *   - Public list/detail routes do NOT require login.
 *   - Admin routes (add, edit, activate/deactivate) are protected by
 *     the `protectAdmin` middleware, so only users with role 'admin'
 *     can access them.
 *
 * Medicines are never permanently deleted. Deactivation is done via the
 * `status` column ('active' | 'inactive') to preserve historical
 * relationships (e.g. pharmacy inventory, wishlist).
 */

const Medicine = require("../models/Medicine");
const Category = require("../models/Category");
const PharmacyInventory = require("../models/PharmacyInventory");
const Wishlist = require("../models/Wishlist");
const {
  normalizeMedicineName,
  isValidMedicineName,
  isValidGenericName,
  isValidStrength,
  isValidDosageForm,
  parsePositiveInt,
} = require("../utils/validation");

// ---- Public routes -------------------------------------------------------

/**
 * GET /medicines
 * Show the public list of active medicines.
 */
async function listMedicines(req, res) {
  try {
    const medicines = await Medicine.findActive();
    res.render("medicine/list", {
      title: "Browse Medicines",
      appName: "Smart Pharmacy Price Comparison",
      medicines,
    });
  } catch (err) {
    console.error("List medicines error:", err);
    req.flash("error", "Could not load medicines. Please try again.");
    return res.redirect("/");
  }
}

/**
 * GET /medicines/:id
 * Show a single medicine's details. Only active medicines are shown to the
 * public. Missing or inactive medicines are handled gracefully (404).
 */
async function showMedicine(req, res) {
  const id = parsePositiveInt(req.params.id);

  // Invalid id -> treat as not found.
  if (!id) {
    return res.status(404).render("error", {
      title: "Medicine Not Found",
      message: "The medicine you are looking for does not exist.",
      statusCode: 404,
    });
  }

  try {
    const medicine = await Medicine.findById(id);

    // Only expose active medicines on the public detail page.
    if (!medicine || medicine.status !== "active") {
      return res.status(404).render("error", {
        title: "Medicine Not Found",
        message: "The medicine you are looking for does not exist.",
        statusCode: 404,
      });
    }

    // Fetch all comparison data. These are independent read queries, so they
    // are run concurrently to avoid unnecessary serialized round-trips while
    // keeping the code clear. All comparison logic stays server-side.
    const [inventory, cheapest, genericAlternatives, alternativeInventory] =
      await Promise.all([
        PharmacyInventory.getMedicineInventory(id),
        PharmacyInventory.getCheapestAvailablePharmacy(id),
        PharmacyInventory.getGenericAlternatives(id),
        PharmacyInventory.getGenericAlternativeInventory(id),
      ]);

    // Determine wishlist state for the currently logged-in user (if any).
    // The medicine detail page is public, so unauthenticated visitors get
    // isInWishlist = false and the view shows a "login to save" prompt.
    let isInWishlist = false;
    if (req.session && req.session.user) {
      isInWishlist = await Wishlist.isInWishlist(
        req.session.user.id,
        medicine.id,
      );
    }

    res.render("medicine/detail", {
      title: medicine.name,
      appName: "Smart Pharmacy Price Comparison",
      medicine,
      inventory,
      cheapest,
      genericAlternatives,
      alternativeInventory,
      isInWishlist,
    });
  } catch (err) {
    console.error("Show medicine error:", err);
    req.flash("error", "Could not load that medicine. Please try again.");
    return res.redirect("/medicines");
  }
}

// ---- Admin routes --------------------------------------------------------

/**
 * GET /admin/medicines
 * Admin list of ALL medicines (active + inactive) with actions.
 */
async function getAdminMedicines(req, res) {
  try {
    const medicines = await Medicine.findAll();
    res.render("medicine/admin-list", {
      title: "Manage Medicines",
      appName: "Smart Pharmacy Price Comparison",
      medicines,
    });
  } catch (err) {
    console.error("Admin list medicines error:", err);
    req.flash("error", "Could not load medicines. Please try again.");
    return res.redirect("/admin/medicines");
  }
}

/**
 * Helper: load categories for form dropdowns.
 */
async function loadCategories() {
  return Category.findAll();
}

/**
 * GET /admin/medicines/add
 * Show the "add medicine" form.
 */
async function getAddMedicine(req, res) {
  try {
    const categories = await loadCategories();
    res.render("medicine/add", {
      title: "Add Medicine",
      appName: "Smart Pharmacy Price Comparison",
      categories,
      values: {},
      errors: {},
    });
  } catch (err) {
    console.error("Add medicine form error:", err);
    req.flash("error", "Could not load the add form. Please try again.");
    return res.redirect("/admin/medicines");
  }
}

/**
 * POST /admin/medicines
 * Handle the "add medicine" form submission.
 */
async function postAddMedicine(req, res) {
  const values = {
    name: normalizeMedicineName(req.body.name),
    generic_name: String(req.body.generic_name || "").trim(),
    category_id: parsePositiveInt(req.body.category_id),
    description: String(req.body.description || "").trim(),
    dosage_form: String(req.body.dosage_form || "").trim(),
    strength: String(req.body.strength || "").trim(),
    prescription_required:
      req.body.prescription_required === "on" ||
      req.body.prescription_required === "1",
    status: req.body.status === "inactive" ? "inactive" : "active",
  };

  const errors = {};

  // ---- Validation ----
  if (!isValidMedicineName(values.name)) {
    errors.name = "Medicine name is required (2-190 characters).";
  }
  if (!isValidGenericName(values.generic_name)) {
    errors.generic_name = "Generic name must be 190 characters or fewer.";
  }
  if (!isValidStrength(values.strength)) {
    errors.strength = "Strength must be 50 characters or fewer.";
  }
  if (!isValidDosageForm(values.dosage_form)) {
    errors.dosage_form = "Dosage form must be 50 characters or fewer.";
  }
  if (
    values.category_id === null ||
    !Number.isInteger(values.category_id) ||
    values.category_id <= 0
  ) {
    errors.category_id = "Please select a category.";
  }

  if (Object.keys(errors).length > 0) {
    const categories = await loadCategories();
    return res.status(400).render("medicine/add", {
      title: "Add Medicine",
      appName: "Smart Pharmacy Price Comparison",
      categories,
      values,
      errors,
    });
  }

  // ---- Verify the selected category actually exists ----
  try {
    const category = await Category.findById(values.category_id);
    if (!category) {
      errors.category_id = "The selected category does not exist.";
      const categories = await loadCategories();
      return res.status(400).render("medicine/add", {
        title: "Add Medicine",
        appName: "Smart Pharmacy Price Comparison",
        categories,
        values,
        errors,
      });
    }

    await Medicine.create(values);
    req.flash("success", `Medicine "${values.name}" was added successfully.`);
    return res.redirect("/admin/medicines");
  } catch (err) {
    console.error("Add medicine error:", err);
    req.flash(
      "error",
      "Something went wrong while adding the medicine. Please try again.",
    );
    return res.redirect("/admin/medicines/add");
  }
}

/**
 * GET /admin/medicines/:id/edit
 * Show the "edit medicine" form pre-filled with existing data.
 */
async function getEditMedicine(req, res) {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    req.flash("error", "Invalid medicine.");
    return res.redirect("/admin/medicines");
  }

  try {
    const medicine = await Medicine.findById(id);
    if (!medicine) {
      req.flash("error", "That medicine does not exist.");
      return res.redirect("/admin/medicines");
    }

    const categories = await loadCategories();
    res.render("medicine/edit", {
      title: `Edit: ${medicine.name}`,
      appName: "Smart Pharmacy Price Comparison",
      medicine,
      categories,
      values: {
        name: medicine.name,
        generic_name: medicine.generic_name || "",
        category_id: medicine.category_id,
        description: medicine.description || "",
        dosage_form: medicine.dosage_form || "",
        strength: medicine.strength || "",
        prescription_required: medicine.prescription_required ? "on" : "",
        status: medicine.status,
      },
      errors: {},
    });
  } catch (err) {
    console.error("Edit medicine form error:", err);
    req.flash(
      "error",
      "Could not load that medicine for editing. Please try again.",
    );
    return res.redirect("/admin/medicines");
  }
}

/**
 * POST /admin/medicines/:id/edit
 * Handle the "edit medicine" form submission.
 */
async function postEditMedicine(req, res) {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    req.flash("error", "Invalid medicine.");
    return res.redirect("/admin/medicines");
  }

  const values = {
    name: normalizeMedicineName(req.body.name),
    generic_name: String(req.body.generic_name || "").trim(),
    category_id: parsePositiveInt(req.body.category_id),
    description: String(req.body.description || "").trim(),
    dosage_form: String(req.body.dosage_form || "").trim(),
    strength: String(req.body.strength || "").trim(),
    prescription_required:
      req.body.prescription_required === "on" ||
      req.body.prescription_required === "1",
    status: req.body.status === "inactive" ? "inactive" : "active",
  };

  const errors = {};

  if (!isValidMedicineName(values.name)) {
    errors.name = "Medicine name is required (2-190 characters).";
  }
  if (!isValidGenericName(values.generic_name)) {
    errors.generic_name = "Generic name must be 190 characters or fewer.";
  }
  if (!isValidStrength(values.strength)) {
    errors.strength = "Strength must be 50 characters or fewer.";
  }
  if (!isValidDosageForm(values.dosage_form)) {
    errors.dosage_form = "Dosage form must be 50 characters or fewer.";
  }
  if (
    values.category_id === null ||
    !Number.isInteger(values.category_id) ||
    values.category_id <= 0
  ) {
    errors.category_id = "Please select a category.";
  }

  if (Object.keys(errors).length > 0) {
    const categories = await loadCategories();
    const medicine = { id };
    return res.status(400).render("medicine/edit", {
      title: "Edit Medicine",
      appName: "Smart Pharmacy Price Comparison",
      medicine,
      categories,
      values,
      errors,
    });
  }

  try {
    const existing = await Medicine.findById(id);
    if (!existing) {
      req.flash("error", "That medicine does not exist.");
      return res.redirect("/admin/medicines");
    }

    const category = await Category.findById(values.category_id);
    if (!category) {
      errors.category_id = "The selected category does not exist.";
      const categories = await loadCategories();
      const medicine = existing;
      return res.status(400).render("medicine/edit", {
        title: "Edit Medicine",
        appName: "Smart Pharmacy Price Comparison",
        medicine,
        categories,
        values,
        errors,
      });
    }

    await Medicine.update(id, values);
    req.flash("success", `Medicine "${values.name}" was updated successfully.`);
    return res.redirect("/admin/medicines");
  } catch (err) {
    console.error("Edit medicine error:", err);
    req.flash(
      "error",
      "Something went wrong while updating the medicine. Please try again.",
    );
    return res.redirect(`/admin/medicines/${id}/edit`);
  }
}

/**
 * POST /admin/medicines/:id/deactivate
 * Soft-deactivate a medicine (status -> 'inactive'). Never deletes.
 */
async function postDeactivate(req, res) {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    req.flash("error", "Invalid medicine.");
    return res.redirect("/admin/medicines");
  }

  try {
    const medicine = await Medicine.findById(id);
    if (!medicine) {
      req.flash("error", "That medicine does not exist.");
      return res.redirect("/admin/medicines");
    }

    await Medicine.setStatus(id, "inactive");
    req.flash("success", `Medicine "${medicine.name}" was deactivated.`);
    return res.redirect("/admin/medicines");
  } catch (err) {
    console.error("Deactivate medicine error:", err);
    req.flash("error", "Something went wrong while deactivating the medicine.");
    return res.redirect("/admin/medicines");
  }
}

/**
 * POST /admin/medicines/:id/activate
 * Re-activate a medicine (status -> 'active').
 */
async function postActivate(req, res) {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    req.flash("error", "Invalid medicine.");
    return res.redirect("/admin/medicines");
  }

  try {
    const medicine = await Medicine.findById(id);
    if (!medicine) {
      req.flash("error", "That medicine does not exist.");
      return res.redirect("/admin/medicines");
    }

    await Medicine.setStatus(id, "active");
    req.flash("success", `Medicine "${medicine.name}" was activated.`);
    return res.redirect("/admin/medicines");
  } catch (err) {
    console.error("Activate medicine error:", err);
    req.flash("error", "Something went wrong while activating the medicine.");
    return res.redirect("/admin/medicines");
  }
}

/**
 * GET /medicines/search?q=...
 * Search active medicines by partial keyword match across name, generic
 * name, category name, dosage form, and strength. Handles empty searches
 * and the no-results state.
 */
async function searchMedicines(req, res) {
  const query = String(req.query.q || "").trim();

  try {
    let medicines = [];
    if (query.length > 0) {
      medicines = await Medicine.search(query);
    }

    res.render("medicine/search", {
      title: query ? `Search: ${query}` : "Search Medicines",
      appName: "Smart Pharmacy Price Comparison",
      query,
      medicines,
    });
  } catch (err) {
    console.error("Search medicines error:", err);
    req.flash(
      "error",
      "Something went wrong while searching. Please try again.",
    );
    return res.redirect("/medicines");
  }
}

/**
 * GET /categories/:id
 * Show active medicines belonging to a category. Invalid or missing
 * categories are handled gracefully (404).
 */
async function listByCategory(req, res) {
  const id = parsePositiveInt(req.params.id);
  if (!id) {
    return res.status(404).render("error", {
      title: "Category Not Found",
      message: "The category you are looking for does not exist.",
      statusCode: 404,
    });
  }

  try {
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).render("error", {
        title: "Category Not Found",
        message: "The category you are looking for does not exist.",
        statusCode: 404,
      });
    }

    const medicines = await Medicine.findActiveByCategory(id);
    res.render("category/medicines", {
      title: category.name,
      appName: "Smart Pharmacy Price Comparison",
      category,
      medicines,
    });
  } catch (err) {
    console.error("List category medicines error:", err);
    req.flash("error", "Could not load that category. Please try again.");
    return res.redirect("/categories");
  }
}

module.exports = {
  listMedicines,
  showMedicine,
  searchMedicines,
  listByCategory,
  getAdminMedicines,
  getAddMedicine,
  postAddMedicine,
  getEditMedicine,
  postEditMedicine,
  postDeactivate,
  postActivate,
};
