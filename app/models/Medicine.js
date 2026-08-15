/**
 * Medicine model.
 *
 * All database access for the medicines table lives here. Every query uses
 * parameterized statements (placeholders like `?`) via the mysql2 pool,
 * which prevents SQL injection.
 *
 * NOTE: Medicines are never hard-deleted. Deactivation is done via the
 * `status` column ('active' | 'inactive') so historical relationships
 * (e.g. pharmacy inventory, wishlist) are preserved.
 */

const { pool } = require("../config/db");
const { escapeLike } = require("../utils/validation");

// Base SELECT that joins categories so medicine rows include category name.
const MEDICINE_SELECT = `
  SELECT
    m.id,
    m.name,
    m.generic_name,
    m.category_id,
    c.name AS category_name,
    m.description,
    m.dosage_form,
    m.strength,
    m.prescription_required,
    m.status,
    m.created_at,
    m.updated_at
  FROM medicines m
  LEFT JOIN categories c ON c.id = m.category_id
`;

/**
 * Map a raw DB row into the shape used by views/controllers.
 * Converts tinyint prescription_required (0/1) into a boolean.
 * @param {Object} row
 * @returns {Object}
 */
function serialize(row) {
  if (!row) return null;
  return {
    ...row,
    prescription_required:
      row.prescription_required === 1 || row.prescription_required === true,
  };
}

/**
 * Return all medicines (active and inactive), newest first.
 * @returns {Promise<Array>}
 */
async function findAll() {
  const [rows] = await pool.query(`${MEDICINE_SELECT} ORDER BY m.name ASC`);
  return rows.map(serialize);
}

/**
 * Count the total number of medicines (all statuses).
 * @returns {Promise<number>}
 */
async function countAll() {
  const [rows] = await pool.query("SELECT COUNT(*) AS total FROM medicines");
  return Number(rows[0].total || 0);
}

/**
 * Count the number of active medicines.
 * @returns {Promise<number>}
 */
async function countActive() {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS total FROM medicines WHERE status = 'active'",
  );
  return Number(rows[0].total || 0);
}

/**
 * Return only active medicines (for public browsing).
 * @returns {Promise<Array>}
 */
async function findActive() {
  const [rows] = await pool.query(
    `${MEDICINE_SELECT} WHERE m.status = 'active' ORDER BY m.name ASC`,
  );
  return rows.map(serialize);
}

/**
 * Find a single medicine by id (regardless of status).
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  const [rows] = await pool.query(`${MEDICINE_SELECT} WHERE m.id = ? LIMIT 1`, [
    id,
  ]);
  return serialize(rows[0]);
}

/**
 * Create a new medicine record.
 * @param {Object} data - { name, generic_name, category_id, description, dosage_form, strength, prescription_required, status }
 * @returns {Promise<Object>} The newly created medicine.
 */
async function create(data) {
  const {
    name,
    generic_name,
    category_id,
    description,
    dosage_form,
    strength,
    prescription_required,
    status,
  } = data;

  const [result] = await pool.query(
    `INSERT INTO medicines
       (name, generic_name, category_id, description, dosage_form, strength, prescription_required, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      generic_name || null,
      category_id || null,
      description || null,
      dosage_form || null,
      strength || null,
      prescription_required ? 1 : 0,
      status || "active",
    ],
  );

  return findById(result.insertId);
}

/**
 * Update an existing medicine record.
 * @param {number} id
 * @param {Object} data - Same fields as create.
 * @returns {Promise<Object|null>} Updated medicine, or null if not found.
 */
async function update(id, data) {
  const {
    name,
    generic_name,
    category_id,
    description,
    dosage_form,
    strength,
    prescription_required,
    status,
  } = data;

  await pool.query(
    `UPDATE medicines SET
       name = ?,
       generic_name = ?,
       category_id = ?,
       description = ?,
       dosage_form = ?,
       strength = ?,
       prescription_required = ?,
       status = ?
     WHERE id = ?`,
    [
      name,
      generic_name || null,
      category_id || null,
      description || null,
      dosage_form || null,
      strength || null,
      prescription_required ? 1 : 0,
      status || "active",
      id,
    ],
  );

  // Whether or not values changed, the persisted row is the source of truth.
  return findById(id);
}

/**
 * Set a medicine's status to 'active' or 'inactive'.
 * Soft-deactivation - never physically deletes the row.
 * @param {number} id
 * @param {string} status - 'active' | 'inactive'
 * @returns {Promise<boolean>} true if a row was updated.
 */
async function setStatus(id, status) {
  const [result] = await pool.query(
    "UPDATE medicines SET status = ? WHERE id = ?",
    [status === "inactive" ? "inactive" : "active", id],
  );
  return result.affectedRows > 0;
}

/**
 * Count active medicines per category (used by category list to show usage).
 * @returns {Promise<Array>} [{ category_id, medicine_count }]
 */
async function countByCategory() {
  const [rows] = await pool.query(
    `SELECT category_id, COUNT(*) AS medicine_count
     FROM medicines
     WHERE status = 'active'
     GROUP BY category_id`,
  );
  return rows;
}

/**
 * Search active medicines by partial keyword match.
 *
 * Matching is case-insensitive (thanks to the `utf8mb4_unicode_ci`
 * collation) and partial — the keyword is wrapped in `%...%` so it can
 * match anywhere within a field. The keyword is escaped so any `%`, `_`,
 * or `\` the user types is treated literally, not as a wildcard.
 *
 * Fields searched: medicine name (brand), generic name, category name,
 * dosage form, and strength. Only active medicines are returned.
 *
 * @param {string} keyword - raw user search term
 * @returns {Promise<Array>}
 */
async function search(keyword) {
  const term = String(keyword || "").trim();
  const pattern = `%${escapeLike(term)}%`;

  const [rows] = await pool.query(
    `SELECT
       m.id,
       m.name,
       m.generic_name,
       m.category_id,
       c.name AS category_name,
       m.description,
       m.dosage_form,
       m.strength,
       m.prescription_required,
       m.status,
       m.created_at,
       m.updated_at
     FROM medicines m
     LEFT JOIN categories c ON c.id = m.category_id
     WHERE m.status = 'active'
       AND (
         m.name LIKE ? ESCAPE '\\\\'
         OR m.generic_name LIKE ? ESCAPE '\\\\'
         OR c.name LIKE ? ESCAPE '\\\\'
         OR m.dosage_form LIKE ? ESCAPE '\\\\'
         OR m.strength LIKE ? ESCAPE '\\\\'
       )
     ORDER BY m.name ASC`,
    [pattern, pattern, pattern, pattern, pattern],
  );
  return rows.map(serialize);
}

/**
 * Return active medicines belonging to a given category.
 * @param {number} categoryId
 * @returns {Promise<Array>}
 */
async function findActiveByCategory(categoryId) {
  const [rows] = await pool.query(
    `${MEDICINE_SELECT}
     WHERE m.status = 'active' AND m.category_id = ?
     ORDER BY m.name ASC`,
    [categoryId],
  );
  return rows.map(serialize);
}

module.exports = {
  findAll,
  findActive,
  findById,
  create,
  update,
  setStatus,
  countAll,
  countActive,
  countByCategory,
  search,
  findActiveByCategory,
};
