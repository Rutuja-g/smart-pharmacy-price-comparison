/**
 * Admin Dashboard controller (Phase 10).
 *
 * Handles the platform administrator dashboard: summary metrics, user
 * management (view, activate/deactivate), and pharmacy management (view,
 * add, edit, activate/deactivate, assign/reassign owner).
 *
 * SECURITY / AUTHORIZATION:
 * Every route handler here is protected by `protectAdmin` middleware, so
 * only users with role 'admin' can reach them. Ids, roles, and ownership
 * are NEVER trusted from the browser; they are always validated and
 * re-checked server-side against the database.
 */

const User = require("../models/User");
const Pharmacy = require("../models/Pharmacy");
const Medicine = require("../models/Medicine");
const PharmacyInventory = require("../models/PharmacyInventory");
const {
  normalizePharmacyName,
  isValidPharmacyName,
  isValidShortText,
  isValidPhone,
  isValidPharmacyStatus,
  parsePositiveInt,
} = require("../utils/validation");

/** Parse and validate a positive integer id. */
const parseId = parsePositiveInt;

// ============================================================
// Dashboard
// ============================================================

/**
 * GET /admin/dashboard
 * Render the admin dashboard with aggregate COUNT metrics.
 */
async function getDashboard(req, res) {
  try {
    // All metrics use aggregate COUNT queries (no records in memory).
    const [
      totalUsers,
      activeUsers,
      pharmacyCounts,
      totalMedicines,
      activeMedicines,
      totalInventory,
      availableInventory,
      outOfStockInventory,
    ] = await Promise.all([
      User.countAll(),
      User.countActive(),
      Pharmacy.statusCounts(),
      Medicine.countAll(),
      Medicine.countActive(),
      PharmacyInventory.countAll(),
      PharmacyInventory.countAvailable(),
      PharmacyInventory.countOutOfStock(),
    ]);

    res.render("admin/dashboard", {
      title: "Admin Dashboard",
      appName: "Smart Pharmacy Price Comparison",
      metrics: {
        totalUsers,
        activeUsers,
        totalPharmacies: pharmacyCounts.total,
        activePharmacies: pharmacyCounts.active,
        pendingPharmacies: pharmacyCounts.pending,
        inactivePharmacies: pharmacyCounts.inactive,
        totalMedicines,
        activeMedicines,
        totalInventory,
        availableInventory,
        outOfStockInventory,
      },
    });
  } catch (err) {
    console.error("Admin dashboard error:", err);
    req.flash("error", "Could not load the dashboard. Please try again.");
    return res.redirect("/");
  }
}

// ============================================================
// User management
// ============================================================

/**
 * GET /admin/users
 * List all users with role + status, and activation controls.
 */
async function getUsers(req, res) {
  try {
    const users = await User.findAll();
    res.render("admin/users", {
      title: "Manage Users",
      appName: "Smart Pharmacy Price Comparison",
      users,
      currentAdminId: req.session.user.id,
    });
  } catch (err) {
    console.error("Admin users error:", err);
    req.flash("error", "Could not load users. Please try again.");
    return res.redirect("/admin/dashboard");
  }
}

/**
 * POST /admin/users/:id/deactivate
 * Deactivate a user account. Safeguards:
 *   - Cannot deactivate the admin's own account.
 *   - Cannot deactivate the last active admin account.
 */
async function postDeactivateUser(req, res) {
  const id = parseId(req.params.id);
  if (!id) {
    req.flash("error", "Invalid user.");
    return res.redirect("/admin/users");
  }

  try {
    const user = await User.findById(id);
    if (!user) {
      req.flash("error", "That user does not exist.");
      return res.redirect("/admin/users");
    }

    // Safeguard 1: cannot deactivate your own account.
    if (user.id === req.session.user.id) {
      req.flash("error", "You cannot deactivate your own account.");
      return res.redirect("/admin/users");
    }

    // Safeguard 2: cannot deactivate the last active admin.
    if (user.role === "admin") {
      const otherActiveAdmins = await User.countActiveAdminsExcept(id);
      if (otherActiveAdmins === 0) {
        req.flash(
          "error",
          "You cannot deactivate the last active admin account.",
        );
        return res.redirect("/admin/users");
      }
    }

    await User.setStatus(id, "inactive");
    req.flash("success", `User "${user.name}" was deactivated.`);
    return res.redirect("/admin/users");
  } catch (err) {
    console.error("Deactivate user error:", err);
    req.flash("error", "Could not deactivate that user. Please try again.");
    return res.redirect("/admin/users");
  }
}

/**
 * POST /admin/users/:id/activate
 * Re-activate a user account.
 */
async function postActivateUser(req, res) {
  const id = parseId(req.params.id);
  if (!id) {
    req.flash("error", "Invalid user.");
    return res.redirect("/admin/users");
  }

  try {
    const user = await User.findById(id);
    if (!user) {
      req.flash("error", "That user does not exist.");
      return res.redirect("/admin/users");
    }

    await User.setStatus(id, "active");
    req.flash("success", `User "${user.name}" was activated.`);
    return res.redirect("/admin/users");
  } catch (err) {
    console.error("Activate user error:", err);
    req.flash("error", "Could not activate that user. Please try again.");
    return res.redirect("/admin/users");
  }
}

// ============================================================
// Pharmacy management
// ============================================================

/**
 * GET /admin/pharmacies
 * List all pharmacies with owner details and status.
 */
async function getPharmacies(req, res) {
  try {
    const pharmacies = await Pharmacy.findAll();
    const owners = await User.findByRole("pharmacy_owner");
    res.render("admin/pharmacies", {
      title: "Manage Pharmacies",
      appName: "Smart Pharmacy Price Comparison",
      pharmacies,
      owners,
    });
  } catch (err) {
    console.error("Admin pharmacies error:", err);
    req.flash("error", "Could not load pharmacies. Please try again.");
    return res.redirect("/admin/dashboard");
  }
}

/**
 * GET /admin/pharmacies/add
 * Show the "add pharmacy" form.
 */
async function getAddPharmacy(req, res) {
  try {
    const owners = await User.findByRole("pharmacy_owner");
    res.render("admin/pharmacy-form", {
      title: "Add Pharmacy",
      appName: "Smart Pharmacy Price Comparison",
      mode: "add",
      pharmacy: null,
      owners,
      values: {},
      errors: {},
    });
  } catch (err) {
    console.error("Add pharmacy form error:", err);
    req.flash("error", "Could not load the add form. Please try again.");
    return res.redirect("/admin/pharmacies");
  }
}

/**
 * POST /admin/pharmacies
 * Handle the "add pharmacy" form submission.
 */
async function postAddPharmacy(req, res) {
  const values = {
    name: normalizePharmacyName(req.body.name),
    address: String(req.body.address || "").trim(),
    city: String(req.body.city || "").trim(),
    state: String(req.body.state || "").trim(),
    phone: String(req.body.phone || "").trim(),
    status: String(req.body.status || "pending"),
    owner_user_id: parseId(req.body.owner_user_id),
  };

  const errors = {};

  if (!isValidPharmacyName(values.name)) {
    errors.name = "Pharmacy name is required (2-150 characters).";
  }
  if (!isValidShortText(values.address, 255)) {
    errors.address = "Address must be 255 characters or fewer.";
  }
  if (!isValidShortText(values.city)) {
    errors.city = "City must be 100 characters or fewer.";
  }
  if (!isValidShortText(values.state)) {
    errors.state = "State must be 100 characters or fewer.";
  }
  if (!isValidPhone(values.phone)) {
    errors.phone = "Phone must be 20 characters or fewer.";
  }
  if (!isValidPharmacyStatus(values.status)) {
    errors.status = "Please select a valid status.";
  }

  if (Object.keys(errors).length > 0) {
    const owners = await User.findByRole("pharmacy_owner");
    return res.status(400).render("admin/pharmacy-form", {
      title: "Add Pharmacy",
      appName: "Smart Pharmacy Price Comparison",
      mode: "add",
      pharmacy: null,
      owners,
      values,
      errors,
    });
  }

  try {
    // Verify selected owner exists and has role 'pharmacy_owner'
    // (only if the admin chose to assign one).
    if (values.owner_user_id) {
      const owner = await User.findById(values.owner_user_id);
      if (!owner || owner.role !== "pharmacy_owner") {
        const owners = await User.findByRole("pharmacy_owner");
        errors.owner_user_id =
          "The selected owner must be a pharmacy owner account.";
        return res.status(400).render("admin/pharmacy-form", {
          title: "Add Pharmacy",
          appName: "Smart Pharmacy Price Comparison",
          mode: "add",
          pharmacy: null,
          owners,
          values,
          errors,
        });
      }
    }

    const pharmacy = await Pharmacy.create(values);
    req.flash("success", `Pharmacy "${pharmacy.name}" was added.`);
    return res.redirect("/admin/pharmacies");
  } catch (err) {
    console.error("Add pharmacy error:", err);
    req.flash("error", "Something went wrong while adding the pharmacy.");
    return res.redirect("/admin/pharmacies/add");
  }
}

/**
 * GET /admin/pharmacies/:id/edit
 * Show the "edit pharmacy" form pre-filled.
 */
async function getEditPharmacy(req, res) {
  const id = parseId(req.params.id);
  if (!id) {
    req.flash("error", "Invalid pharmacy.");
    return res.redirect("/admin/pharmacies");
  }

  try {
    const pharmacy = await Pharmacy.findById(id);
    if (!pharmacy) {
      req.flash("error", "That pharmacy does not exist.");
      return res.redirect("/admin/pharmacies");
    }

    const owners = await User.findByRole("pharmacy_owner");
    res.render("admin/pharmacy-form", {
      title: `Edit: ${pharmacy.name}`,
      appName: "Smart Pharmacy Price Comparison",
      mode: "edit",
      pharmacy,
      owners,
      values: {
        name: pharmacy.name,
        address: pharmacy.address || "",
        city: pharmacy.city || "",
        state: pharmacy.state || "",
        phone: pharmacy.phone || "",
        status: pharmacy.status,
        owner_user_id: pharmacy.owner_user_id || "",
      },
      errors: {},
    });
  } catch (err) {
    console.error("Edit pharmacy form error:", err);
    req.flash("error", "Could not load that pharmacy for editing.");
    return res.redirect("/admin/pharmacies");
  }
}

/**
 * POST /admin/pharmacies/:id/edit
 * Handle the "edit pharmacy" form submission (incl. owner reassignment).
 */
async function postEditPharmacy(req, res) {
  const id = parseId(req.params.id);
  if (!id) {
    req.flash("error", "Invalid pharmacy.");
    return res.redirect("/admin/pharmacies");
  }

  const values = {
    name: normalizePharmacyName(req.body.name),
    address: String(req.body.address || "").trim(),
    city: String(req.body.city || "").trim(),
    state: String(req.body.state || "").trim(),
    phone: String(req.body.phone || "").trim(),
    status: String(req.body.status || "pending"),
    owner_user_id: req.body.owner_user_id
      ? parseId(req.body.owner_user_id)
      : null,
  };

  const errors = {};

  if (!isValidPharmacyName(values.name)) {
    errors.name = "Pharmacy name is required (2-150 characters).";
  }
  if (!isValidShortText(values.address, 255)) {
    errors.address = "Address must be 255 characters or fewer.";
  }
  if (!isValidShortText(values.city)) {
    errors.city = "City must be 100 characters or fewer.";
  }
  if (!isValidShortText(values.state)) {
    errors.state = "State must be 100 characters or fewer.";
  }
  if (!isValidPhone(values.phone)) {
    errors.phone = "Phone must be 20 characters or fewer.";
  }
  if (!isValidPharmacyStatus(values.status)) {
    errors.status = "Please select a valid status.";
  }

  const renderEdit = async (statusCode) => {
    const owners = await User.findByRole("pharmacy_owner");
    return res.status(statusCode).render("admin/pharmacy-form", {
      title: "Edit Pharmacy",
      appName: "Smart Pharmacy Price Comparison",
      mode: "edit",
      pharmacy: { id },
      owners,
      values,
      errors,
    });
  };

  if (Object.keys(errors).length > 0) {
    return renderEdit(400);
  }

  try {
    const existing = await Pharmacy.findById(id);
    if (!existing) {
      req.flash("error", "That pharmacy does not exist.");
      return res.redirect("/admin/pharmacies");
    }

    // Verify selected owner exists and has role 'pharmacy_owner'.
    if (values.owner_user_id) {
      const owner = await User.findById(values.owner_user_id);
      if (!owner || owner.role !== "pharmacy_owner") {
        const owners = await User.findByRole("pharmacy_owner");
        errors.owner_user_id =
          "The selected owner must be a pharmacy owner account.";
        return res.status(400).render("admin/pharmacy-form", {
          title: "Edit Pharmacy",
          appName: "Smart Pharmacy Price Comparison",
          mode: "edit",
          pharmacy: existing,
          owners,
          values,
          errors,
        });
      }
    }

    await Pharmacy.update(id, values);
    req.flash("success", `Pharmacy "${values.name}" was updated.`);
    return res.redirect("/admin/pharmacies");
  } catch (err) {
    console.error("Edit pharmacy error:", err);
    req.flash("error", "Something went wrong while updating the pharmacy.");
    return res.redirect(`/admin/pharmacies/${id}/edit`);
  }
}

/**
 * POST /admin/pharmacies/:id/:status
 * Activate / deactivate / set pending a pharmacy.
 * Only 'active' | 'inactive' | 'pending' are accepted.
 */
async function postSetPharmacyStatus(req, res) {
  const id = parseId(req.params.id);
  const status = String(req.params.status || "");
  if (!id || !["active", "inactive", "pending"].includes(status)) {
    req.flash("error", "Invalid request.");
    return res.redirect("/admin/pharmacies");
  }

  try {
    const pharmacy = await Pharmacy.findById(id);
    if (!pharmacy) {
      req.flash("error", "That pharmacy does not exist.");
      return res.redirect("/admin/pharmacies");
    }

    await Pharmacy.setStatus(id, status);
    req.flash("success", `Pharmacy "${pharmacy.name}" is now ${status}.`);
    return res.redirect("/admin/pharmacies");
  } catch (err) {
    console.error("Set pharmacy status error:", err);
    req.flash("error", "Could not update the pharmacy status.");
    return res.redirect("/admin/pharmacies");
  }
}

module.exports = {
  getDashboard,
  getUsers,
  postDeactivateUser,
  postActivateUser,
  getPharmacies,
  getAddPharmacy,
  postAddPharmacy,
  getEditPharmacy,
  postEditPharmacy,
  postSetPharmacyStatus,
};
