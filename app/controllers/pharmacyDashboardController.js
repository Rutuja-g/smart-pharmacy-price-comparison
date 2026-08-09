/**
 * Pharmacy Dashboard controller.
 *
 * Handles the pharmacy admin dashboard: viewing pharmacy info, managing
 * inventory (add, update stock, update price, toggle availability), and
 * viewing/searching/filtering inventory.
 *
 * SECURITY / AUTHORIZATION:
 * A pharmacy_owner may own MULTIPLE pharmacies. Ownership is ALWAYS derived
 * from the authenticated user's id (req.session.user.id) and NEVER trusted
 * from a pharmacy id sent by the browser. Every handler:
 *
 *   1. Loads all pharmacies owned by the session user.
 *   2. Resolves the "selected" pharmacy (from query/body, or the first one
 *      owned by the user as a default).
 *   3. Verifies the selected pharmacy belongs to the user via
 *      Pharmacy.findByIdAndOwner(pharmacyId, req.session.user.id). If it does
 *      NOT belong to them, the request is rejected.
 *   4. Only then performs any database operation.
 *
 * This ensures a pharmacy owner can never read or modify another owner's
 * pharmacy inventory.
 */

const Pharmacy = require("../models/Pharmacy");
const Medicine = require("../models/Medicine");
const PharmacyInventory = require("../models/PharmacyInventory");
const {
  parsePositiveInt,
  parseNonNegativeInt,
  parsePositiveNumber,
} = require("../utils/validation");

/** Parse and validate a positive integer id. */
const parseId = parsePositiveInt;

/** Parse a non-negative integer stock quantity. */
const parseStock = parseNonNegativeInt;

/** Parse a positive number (price). */
const parsePrice = parsePositiveNumber;

/**
 * Load all pharmacies owned by the session user.
 * @param {Object} req
 * @returns {Promise<Array>}
 */
async function loadOwnedPharmacies(req) {
  return Pharmacy.findAllByOwnerUserId(req.session.user.id);
}

/**
 * Resolve the currently selected pharmacy for the request.
 *
 * If `requestedId` is provided, it is verified to belong to the user via
 * findByIdAndOwner(). If it does not belong to them, returns null (caller
 * rejects). If no id is provided, defaults to the user's first pharmacy
 * (owner with a single pharmacy gets it automatically).
 *
 * @param {Object} req
 * @param {number|null} requestedId - pharmacy id from query/body (untrusted)
 * @returns {Promise<Object|null>} verified-owned pharmacy, or null
 */
async function resolveSelectedPharmacy(req, requestedId) {
  if (requestedId) {
    const id = parseId(requestedId);
    if (!id) return null;
    // Ownership is verified here, never trusted from the browser alone.
    return Pharmacy.findByIdAndOwner(id, req.session.user.id);
  }
  // Default: first pharmacy owned by the user.
  const owned = await loadOwnedPharmacies(req);
  return owned.length > 0 ? owned[0] : null;
}

/**
 * Render the pharmacy dashboard with summary info for the selected pharmacy.
 *
 * GET /pharmacy/dashboard
 */
async function getDashboard(req, res) {
  try {
    const pharmacies = await loadOwnedPharmacies(req);
    if (pharmacies.length === 0) {
      return res.render("pharmacy/dashboard", {
        title: "Pharmacy Dashboard",
        appName: "Smart Pharmacy Price Comparison",
        pharmacies: [],
        selectedPharmacy: null,
        summary: null,
        values: {},
        errors: {},
      });
    }

    const selectedPharmacy = await resolveSelectedPharmacy(
      req,
      req.query.pharmacyId,
    );
    if (!selectedPharmacy) {
      req.flash("error", "You do not have access to that pharmacy.");
      return res.redirect("/pharmacy/dashboard");
    }

    const summary = await PharmacyInventory.getSummary(selectedPharmacy.id);

    res.render("pharmacy/dashboard", {
      title: "Pharmacy Dashboard",
      appName: "Smart Pharmacy Price Comparison",
      pharmacies,
      selectedPharmacy,
      summary,
      values: {},
      errors: {},
    });
  } catch (err) {
    console.error("Pharmacy dashboard error:", err);
    req.flash(
      "error",
      "Could not load the pharmacy dashboard. Please try again.",
    );
    return res.redirect("/");
  }
}

/**
 * Render the inventory list for the selected pharmacy, with optional
 * keyword search and availability filter.
 *
 * GET /pharmacy/inventory?pharmacyId=&q=&filter=
 */
async function getInventory(req, res) {
  try {
    const pharmacies = await loadOwnedPharmacies(req);
    if (pharmacies.length === 0) {
      return res.render("pharmacy/inventory", {
        title: "Pharmacy Inventory",
        appName: "Smart Pharmacy Price Comparison",
        pharmacies: [],
        selectedPharmacy: null,
        inventory: [],
        search: "",
        filter: "all",
        values: {},
        errors: {},
      });
    }

    const selectedPharmacy = await resolveSelectedPharmacy(
      req,
      req.query.pharmacyId,
    );
    if (!selectedPharmacy) {
      req.flash("error", "You do not have access to that pharmacy.");
      return res.redirect("/pharmacy/dashboard");
    }

    const search = String(req.query.q || "").trim();
    const filter = ["available", "out"].includes(String(req.query.filter || ""))
      ? String(req.query.filter)
      : "all";

    const inventory = await PharmacyInventory.findByPharmacy(
      selectedPharmacy.id,
      { search, filter },
    );

    res.render("pharmacy/inventory", {
      title: "Pharmacy Inventory",
      appName: "Smart Pharmacy Price Comparison",
      pharmacies,
      selectedPharmacy,
      inventory,
      search,
      filter,
      values: {},
      errors: {},
    });
  } catch (err) {
    console.error("Pharmacy inventory error:", err);
    req.flash("error", "Could not load the inventory. Please try again.");
    return res.redirect("/pharmacy/dashboard");
  }
}

/**
 * Render the "add inventory" form for the selected pharmacy.
 *
 * GET /pharmacy/inventory/add?pharmacyId=
 */
async function getAddInventory(req, res) {
  try {
    const pharmacies = await loadOwnedPharmacies(req);
    if (pharmacies.length === 0) {
      req.flash("error", "You do not own any pharmacy.");
      return res.redirect("/pharmacy/dashboard");
    }

    const selectedPharmacy = await resolveSelectedPharmacy(
      req,
      req.query.pharmacyId,
    );
    if (!selectedPharmacy) {
      req.flash("error", "You do not have access to that pharmacy.");
      return res.redirect("/pharmacy/dashboard");
    }

    const medicines = await Medicine.findActive();

    res.render("pharmacy/add-inventory", {
      title: "Add Inventory",
      appName: "Smart Pharmacy Price Comparison",
      pharmacies,
      selectedPharmacy,
      medicines,
      values: {},
      errors: {},
    });
  } catch (err) {
    console.error("Add inventory form error:", err);
    req.flash(
      "error",
      "Could not load the add inventory form. Please try again.",
    );
    return res.redirect("/pharmacy/dashboard");
  }
}

/**
 * Handle the "add inventory" form submission.
 *
 * POST /pharmacy/inventory
 * The pharmacy id is verified to belong to the user before inserting.
 */
async function postAddInventory(req, res) {
  const values = {
    pharmacyId: parseId(req.body.pharmacyId),
    medicineId: parseId(req.body.medicineId),
    stock: parseStock(req.body.stock),
    price: parsePrice(req.body.price),
  };
  const errors = {};

  try {
    const pharmacies = await loadOwnedPharmacies(req);
    if (pharmacies.length === 0) {
      req.flash("error", "You do not own any pharmacy.");
      return res.redirect("/pharmacy/dashboard");
    }

    // Resolve + verify the selected pharmacy belongs to the user.
    const selectedPharmacy = await resolveSelectedPharmacy(
      req,
      values.pharmacyId,
    );
    if (!selectedPharmacy) {
      req.flash("error", "You do not have access to that pharmacy.");
      return res.redirect("/pharmacy/dashboard");
    }

    // Validate inputs.
    if (!values.medicineId) {
      errors.medicineId = "Please select a medicine.";
    }
    if (values.stock === null) {
      errors.stock = "Stock must be a non-negative whole number.";
    }
    if (values.price === null) {
      errors.price = "Price must be a positive number.";
    }

    if (Object.keys(errors).length > 0) {
      const medicines = await Medicine.findActive();
      return res.status(400).render("pharmacy/add-inventory", {
        title: "Add Inventory",
        appName: "Smart Pharmacy Price Comparison",
        pharmacies,
        selectedPharmacy,
        medicines,
        values: {
          pharmacyId: selectedPharmacy.id,
          medicineId: values.medicineId,
          stock: req.body.stock,
          price: req.body.price,
        },
        errors,
      });
    }

    const result = await PharmacyInventory.addInventory(
      selectedPharmacy.id,
      values.medicineId,
      values.stock,
      values.price,
    );

    req.flash(
      "success",
      result.created
        ? "Inventory record added successfully."
        : "Existing inventory record updated successfully.",
    );
    return res.redirect(
      `/pharmacy/inventory?pharmacyId=${selectedPharmacy.id}`,
    );
  } catch (err) {
    console.error("Add inventory error:", err);
    if (err.code === "INVALID_MEDICINE") {
      req.flash("error", err.message);
      return res.redirect(
        `/pharmacy/inventory/add?pharmacyId=${req.body.pharmacyId}`,
      );
    }
    req.flash(
      "error",
      "Something went wrong while adding the inventory. Please try again.",
    );
    return res.redirect(
      `/pharmacy/inventory/add?pharmacyId=${req.body.pharmacyId}`,
    );
  }
}

/**
 * Update the stock quantity (and derived availability) for an inventory row.
 *
 * POST /pharmacy/inventory/:id/stock
 */
async function postUpdateStock(req, res) {
  const ownerId = req.session.user.id;
  const inventoryId = parseId(req.params.id);
  const stock = parseStock(req.body.stock);
  const pharmacyId = parseId(req.body.pharmacyId);

  if (!inventoryId || !pharmacyId) {
    req.flash("error", "Invalid request.");
    return res.redirect("/pharmacy/dashboard");
  }

  try {
    // Verify the pharmacy belongs to the owner BEFORE any DB write.
    const pharmacy = await Pharmacy.findByIdAndOwner(pharmacyId, ownerId);
    if (!pharmacy) {
      req.flash("error", "You do not have access to that pharmacy.");
      return res.redirect("/pharmacy/dashboard");
    }

    if (stock === null) {
      req.flash("error", "Stock must be a non-negative whole number.");
      return res.redirect(`/pharmacy/inventory?pharmacyId=${pharmacyId}`);
    }

    const updated = await PharmacyInventory.updateStock(
      pharmacy.id,
      inventoryId,
      stock,
    );
    if (!updated) {
      req.flash("error", "That inventory record was not found.");
      return res.redirect(`/pharmacy/inventory?pharmacyId=${pharmacyId}`);
    }

    req.flash(
      "success",
      `Stock updated to ${stock} for "${updated.medicine_name}".`,
    );
    return res.redirect(`/pharmacy/inventory?pharmacyId=${pharmacyId}`);
  } catch (err) {
    console.error("Update stock error:", err);
    req.flash("error", "Could not update stock. Please try again.");
    return res.redirect(`/pharmacy/inventory?pharmacyId=${pharmacyId}`);
  }
}

/**
 * Update the selling price for an inventory row.
 *
 * POST /pharmacy/inventory/:id/price
 */
async function postUpdatePrice(req, res) {
  const ownerId = req.session.user.id;
  const inventoryId = parseId(req.params.id);
  const price = parsePrice(req.body.price);
  const pharmacyId = parseId(req.body.pharmacyId);

  if (!inventoryId || !pharmacyId) {
    req.flash("error", "Invalid request.");
    return res.redirect("/pharmacy/dashboard");
  }

  try {
    // Verify the pharmacy belongs to the owner BEFORE any DB write.
    const pharmacy = await Pharmacy.findByIdAndOwner(pharmacyId, ownerId);
    if (!pharmacy) {
      req.flash("error", "You do not have access to that pharmacy.");
      return res.redirect("/pharmacy/dashboard");
    }

    if (price === null) {
      req.flash("error", "Price must be a positive number.");
      return res.redirect(`/pharmacy/inventory?pharmacyId=${pharmacyId}`);
    }

    const updated = await PharmacyInventory.updatePrice(
      pharmacy.id,
      inventoryId,
      price,
    );
    if (!updated) {
      req.flash("error", "That inventory record was not found.");
      return res.redirect(`/pharmacy/inventory?pharmacyId=${pharmacyId}`);
    }

    req.flash(
      "success",
      `Price updated to ${price.toFixed(2)} for "${updated.medicine_name}".`,
    );
    return res.redirect(`/pharmacy/inventory?pharmacyId=${pharmacyId}`);
  } catch (err) {
    console.error("Update price error:", err);
    req.flash("error", "Could not update the price. Please try again.");
    return res.redirect(`/pharmacy/inventory?pharmacyId=${pharmacyId}`);
  }
}

/**
 * Toggle the availability flag for an inventory row.
 *
 * POST /pharmacy/inventory/:id/availability
 * Body: { pharmacyId, available: '1' | '0' }
 */
async function postToggleAvailability(req, res) {
  const ownerId = req.session.user.id;
  const inventoryId = parseId(req.params.id);
  const pharmacyId = parseId(req.body.pharmacyId);
  const available = req.body.available === "1" || req.body.available === "true";

  if (!inventoryId || !pharmacyId) {
    req.flash("error", "Invalid request.");
    return res.redirect("/pharmacy/dashboard");
  }

  try {
    // Verify the pharmacy belongs to the owner BEFORE any DB write.
    const pharmacy = await Pharmacy.findByIdAndOwner(pharmacyId, ownerId);
    if (!pharmacy) {
      req.flash("error", "You do not have access to that pharmacy.");
      return res.redirect("/pharmacy/dashboard");
    }

    const updated = await PharmacyInventory.setAvailability(
      pharmacy.id,
      inventoryId,
      available,
    );
    if (!updated) {
      req.flash("error", "That inventory record was not found.");
      return res.redirect(`/pharmacy/inventory?pharmacyId=${pharmacyId}`);
    }

    req.flash(
      "success",
      `"${updated.medicine_name}" marked ${available ? "available" : "out of stock"}.`,
    );
    return res.redirect(`/pharmacy/inventory?pharmacyId=${pharmacyId}`);
  } catch (err) {
    console.error("Toggle availability error:", err);
    req.flash("error", "Could not update availability. Please try again.");
    return res.redirect(`/pharmacy/inventory?pharmacyId=${pharmacyId}`);
  }
}

module.exports = {
  getDashboard,
  getInventory,
  getAddInventory,
  postAddInventory,
  postUpdateStock,
  postUpdatePrice,
  postToggleAvailability,
};
