/**
 * Input validation helpers.
 *
 * These are lightweight, dependency-free validators used by the auth
 * controller to validate registration and login input before touching
 * the database.
 */

/**
 * Normalize an email string to lowercase and trim whitespace.
 * @param {string} email
 * @returns {string}
 */
function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

/**
 * Validate an email address.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

/**
 * Normalize a name (collapse multiple spaces, trim).
 * @param {string} name
 * @returns {string}
 */
function normalizeName(name) {
  return String(name || "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Validate that a name is present and within limits.
 * @param {string} name
 * @returns {boolean}
 */
function isValidName(name) {
  const n = normalizeName(name);
  return n.length >= 2 && n.length <= 100;
}

/**
 * Validate a password meets minimum requirements.
 * @param {string} password
 * @returns {boolean}
 */
function isValidPassword(password) {
  return typeof password === "string" && password.length >= 8;
}

// ============================================================
// Medicine & category validators (Phase 5)
// ============================================================

/**
 * Normalize a medicine/category name (trim + collapse spaces).
 * @param {string} value
 * @returns {string}
 */
function normalizeMedicineName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Validate a medicine/brand name (2-190 chars).
 * @param {string} value
 * @returns {boolean}
 */
function isValidMedicineName(value) {
  const n = normalizeMedicineName(value);
  return n.length >= 2 && n.length <= 190;
}

/**
 * Validate a generic name (optional; up to 190 chars if provided).
 * @param {string} value
 * @returns {boolean}
 */
function isValidGenericName(value) {
  const v = String(value || "").trim();
  if (v.length === 0) return true; // optional
  return v.length <= 190;
}

/**
 * Validate a strength / dosage value (max 50 chars).
 * @param {string} value
 * @returns {boolean}
 */
function isValidStrength(value) {
  const v = String(value || "").trim();
  if (v.length === 0) return true; // optional
  return v.length <= 50;
}

/**
 * Validate a dosage form (max 50 chars).
 * @param {string} value
 * @returns {boolean}
 */
function isValidDosageForm(value) {
  const v = String(value || "").trim();
  if (v.length === 0) return true; // optional
  return v.length <= 50;
}

/**
 * Validate a category name (2-100 chars).
 * @param {string} value
 * @returns {boolean}
 */
function isValidCategoryName(value) {
  const n = normalizeMedicineName(value);
  return n.length >= 2 && n.length <= 100;
}

/**
 * Validate a category description (max 255 chars).
 * @param {string} value
 * @returns {boolean}
 */
function isValidDescription(value) {
  const v = String(value || "").trim();
  if (v.length === 0) return true; // optional
  return v.length <= 255;
}

// ============================================================
// Pharmacy validators (Phase 10)
// ============================================================

/**
 * Normalize a pharmacy name (trim + collapse spaces).
 * @param {string} value
 * @returns {string}
 */
function normalizePharmacyName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Validate a pharmacy name (2-150 chars).
 * @param {string} value
 * @returns {boolean}
 */
function isValidPharmacyName(value) {
  const n = normalizePharmacyName(value);
  return n.length >= 2 && n.length <= 150;
}

/**
 * Validate a generic short text field (e.g. city/state). Optional.
 * @param {string} value
 * @param {number} [max]
 * @returns {boolean}
 */
function isValidShortText(value, max = 100) {
  const v = String(value || "").trim();
  if (v.length === 0) return true; // optional
  return v.length <= max;
}

/**
 * Validate a pharmacy phone number (optional, max 20 chars).
 * @param {string} value
 * @returns {boolean}
 */
function isValidPhone(value) {
  const v = String(value || "").trim();
  if (v.length === 0) return true; // optional
  return v.length <= 20;
}

/**
 * Validate a pharmacy status value.
 * @param {string} value
 * @returns {boolean}
 */
function isValidPharmacyStatus(value) {
  return ["active", "inactive", "pending"].includes(String(value || ""));
}

// ============================================================
// Generic id / numeric helpers (Phase 11)
// ============================================================

/**
 * Parse a route/query/body value into a positive integer id.
 * Returns null when the value is not a valid positive integer, so callers
 * can safely reject the request. Never trust a raw browser-supplied id.
 * @param {any} raw
 * @returns {number|null} a positive integer, or null
 */
function parsePositiveInt(raw) {
  // Reject partial numeric strings such as "1abc"; accepting them could
  // make a malformed route/body id target record 1.
  const value = typeof raw === "string" ? raw.trim() : raw;
  if (value === "") return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Parse a non-negative integer (e.g. stock quantity).
 * Returns null when the value is not a valid non-negative integer.
 * @param {any} raw
 * @returns {number|null} a non-negative integer, or null
 */
function parseNonNegativeInt(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/**
 * Parse a positive number (e.g. price). Must be finite and > 0.
 * Returns null when invalid.
 * @param {any} raw
 * @returns {number|null} a positive finite number, or null
 */
function parsePositiveNumber(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

module.exports = {
  parsePositiveInt,
  parseNonNegativeInt,
  parsePositiveNumber,
  normalizeEmail,
  normalizeName,
  isValidEmail,
  isValidName,
  isValidPassword,
  normalizeMedicineName,
  isValidMedicineName,
  isValidGenericName,
  isValidStrength,
  isValidDosageForm,
  isValidCategoryName,
  isValidDescription,
  normalizePharmacyName,
  isValidPharmacyName,
  isValidShortText,
  isValidPhone,
  isValidPharmacyStatus,
};
