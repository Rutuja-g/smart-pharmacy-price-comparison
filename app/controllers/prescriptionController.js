/**
 * Prescription controller.
 *
 * Handles prescription upload, OCR processing, candidate medicine review,
 * user confirmation, and multi-medicine price comparison.
 */

const Medicine = require("../models/Medicine");
const PharmacyInventory = require("../models/PharmacyInventory");
const { extractMedicineCandidates } = require("../utils/ocr");
const { parsePositiveInt } = require("../utils/validation");

/**
 * GET /prescription/upload
 * Show the prescription upload form.
 */
async function getUpload(req, res) {
  res.render("prescription/upload", {
    title: "Upload Prescription",
    appName: "Smart Pharmacy Price Comparison",
  });
}

/**
 * POST /prescription/process?_csrf=...
 * Process the uploaded prescription image using in-memory OCR.
 */
async function processUpload(req, res) {
  if (!req.file || !req.file.buffer) {
    req.flash("error", "Please select a prescription image to upload.");
    return res.redirect("/prescription/upload");
  }

  try {
    const candidates = await extractMedicineCandidates(req.file.buffer);

    // Save candidates to session (no image buffer stored in session)
    req.session.prescription = {
      candidates: candidates && candidates.length > 0 ? candidates : [""],
      confirmedMedicineIds: [],
    };

    return res.redirect("/prescription/review");
  } catch (err) {
    console.error("Prescription process error:", err);
    req.flash(
      "error",
      "Could not process the uploaded prescription image. Please try again.",
    );
    return res.redirect("/prescription/upload");
  }
}

/**
 * GET /prescription/review
 * Show candidate medicine terms and database search matches for user confirmation.
 */
async function getReview(req, res) {
  if (!req.session || !req.session.prescription || !req.session.prescription.candidates) {
    req.flash("error", "Please upload a prescription image first.");
    return res.redirect("/prescription/upload");
  }

  const candidates = req.session.prescription.candidates;

  try {
    // For each candidate search term, perform candidate database lookup via Medicine.search
    const candidateMatches = await Promise.all(
      candidates.map(async (term) => {
        const queryTerm = String(term || "").trim();
        let matches = [];
        if (queryTerm.length > 0) {
          matches = await Medicine.search(queryTerm);
        }
        return {
          candidate: queryTerm,
          matches,
        };
      }),
    );

    res.render("prescription/review", {
      title: "Review Prescription Medicines",
      appName: "Smart Pharmacy Price Comparison",
      candidateMatches,
    });
  } catch (err) {
    console.error("Prescription review error:", err);
    req.flash(
      "error",
      "Something went wrong while searching medicines for your prescription.",
    );
    return res.redirect("/prescription/upload");
  }
}

/**
 * POST /prescription/confirm
 * Validate user-selected medicine IDs and store in session for comparison.
 */
async function postConfirm(req, res) {
  if (!req.session || !req.session.prescription) {
    req.flash("error", "Your prescription session expired. Please try again.");
    return res.redirect("/prescription/upload");
  }

  // Handle submitted medicine_ids (single string or array)
  let rawIds = req.body.medicine_ids;
  if (!rawIds) {
    rawIds = [];
  } else if (!Array.isArray(rawIds)) {
    rawIds = [rawIds];
  }

  const validMedicineIds = [];
  for (const raw of rawIds) {
    const id = parsePositiveInt(raw);
    if (id) {
      // Verify medicine exists and is active in DB
      try {
        const med = await Medicine.findById(id);
        if (med && med.status === "active" && !validMedicineIds.includes(med.id)) {
          validMedicineIds.push(med.id);
        }
      } catch (err) {
        console.error("Medicine lookup error during confirmation:", err);
      }
    }
  }

  if (validMedicineIds.length === 0) {
    req.flash(
      "error",
      "Please select at least one valid active medicine to compare prices.",
    );
    return res.redirect("/prescription/review");
  }

  req.session.prescription.confirmedMedicineIds = validMedicineIds;
  return res.redirect("/prescription/compare");
}

/**
 * GET /prescription/compare
 * Compare price and availability across pharmacies for confirmed prescription medicines.
 */
async function getCompare(req, res) {
  if (
    !req.session ||
    !req.session.prescription ||
    !Array.isArray(req.session.prescription.confirmedMedicineIds) ||
    req.session.prescription.confirmedMedicineIds.length === 0
  ) {
    req.flash("error", "No confirmed prescription medicines found to compare.");
    return res.redirect("/prescription/upload");
  }

  const confirmedIds = [...req.session.prescription.confirmedMedicineIds];

  try {
    const items = await Promise.all(
      confirmedIds.map(async (id) => {
        const [
          medicine,
          inventory,
          cheapest,
          genericAlternatives,
          alternativeInventory,
        ] = await Promise.all([
          Medicine.findById(id),
          PharmacyInventory.getMedicineInventory(id),
          PharmacyInventory.getCheapestAvailablePharmacy(id),
          PharmacyInventory.getGenericAlternatives(id),
          PharmacyInventory.getGenericAlternativeInventory(id),
        ]);

        return {
          medicine,
          inventory,
          cheapest,
          genericAlternatives,
          alternativeInventory,
        };
      }),
    );

    // Filter out any missing/null medicines
    const validItems = items.filter((item) => item.medicine && item.medicine.status === "active");

    if (validItems.length === 0) {
      req.flash("error", "The selected medicines are no longer active or available.");
      return res.redirect("/prescription/upload");
    }

    // Clear prescription state from session to prevent stale state on subsequent navigation
    req.session.prescription = null;

    res.render("prescription/compare", {
      title: "Prescription Price Comparison",
      appName: "Smart Pharmacy Price Comparison",
      items: validItems,
    });
  } catch (err) {
    console.error("Prescription compare error:", err);
    req.flash(
      "error",
      "Could not perform price comparison. Please try again.",
    );
    return res.redirect("/prescription/upload");
  }
}

/**
 * POST /prescription/reset
 * Clear prescription session state and redirect to upload.
 */
async function postReset(req, res) {
  if (req.session) {
    req.session.prescription = null;
  }
  return res.redirect("/prescription/upload");
}

module.exports = {
  getUpload,
  processUpload,
  getReview,
  postConfirm,
  getCompare,
  postReset,
};
