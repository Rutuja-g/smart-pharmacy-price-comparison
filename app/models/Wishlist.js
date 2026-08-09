/**
 * Wishlist model.
 *
 * All database access for the wishlist table lives here. Every query uses
 * parameterized statements (placeholders like `?`) via the mysql2 pool,
 * which prevents SQL injection.
 *
 * SECURITY: Every method takes the `userId` as an explicit argument. The
 * controller always passes the authenticated user's id from the session —
 * it never trusts a user id sent from the browser. This guarantees a user
 * can only ever read/add/remove their OWN wishlist rows.
 *
 * DUPLICATE PREVENTION: The wishlist table has a UNIQUE(user_id, medicine_id)
 * constraint (uk_wishlist_user_medicine). `add()` uses `INSERT IGNORE` so a
 * repeat add is silently ignored rather than throwing a duplicate-key error.
 */

const { pool } = require("../config/db");

/**
 * Add a medicine to a user's wishlist.
 *
 * Idempotent by design: `INSERT IGNORE` swallows the duplicate-key error that
 * would otherwise be raised by the UNIQUE(user_id, medicine_id) constraint.
 * Adding the same medicine twice is therefore a harmless no-op.
 *
 * @param {number} userId   - authenticated user's id (from the session)
 * @param {number} medicineId - id of the medicine to save
 * @returns {Promise<boolean>} true if a row was inserted, false if it already existed
 */
async function add(userId, medicineId) {
  const [result] = await pool.query(
    "INSERT IGNORE INTO wishlist (user_id, medicine_id) VALUES (?, ?)",
    [userId, medicineId],
  );
  return result.affectedRows > 0;
}

/**
 * Remove a medicine from a user's wishlist.
 *
 * The WHERE clause scopes the delete to BOTH the user id and the medicine id,
 * so a user can only ever remove their own entries. Removing a non-existent
 * row is a harmless no-op.
 *
 * @param {number} userId
 * @param {number} medicineId
 * @returns {Promise<boolean>} true if a row was deleted
 */
async function remove(userId, medicineId) {
  const [result] = await pool.query(
    "DELETE FROM wishlist WHERE user_id = ? AND medicine_id = ?",
    [userId, medicineId],
  );
  return result.affectedRows > 0;
}

/**
 * List all medicines in a user's wishlist, joined with medicine + category
 * details so the UI can show name, generic name, category, form, and strength.
 * Ordered newest first.
 *
 * @param {number} userId
 * @returns {Promise<Array>}
 */
async function findByUser(userId) {
  const [rows] = await pool.query(
    `SELECT
       w.id           AS wishlist_id,
       w.created_at   AS saved_at,
       m.id           AS medicine_id,
       m.name,
       m.generic_name,
       m.category_id,
       c.name         AS category_name,
       m.description,
       m.dosage_form,
       m.strength,
       m.prescription_required,
       m.status
     FROM wishlist w
     INNER JOIN medicines m ON m.id = w.medicine_id
     LEFT JOIN categories c ON c.id = m.category_id
     WHERE w.user_id = ?
     ORDER BY w.created_at DESC`,
    [userId],
  );
  return rows.map((row) => ({
    ...row,
    prescription_required:
      row.prescription_required === 1 || row.prescription_required === true,
  }));
}

/**
 * Check whether a specific medicine is already in a user's wishlist.
 * Used by the medicine detail page to render the correct button state.
 *
 * @param {number} userId
 * @param {number} medicineId
 * @returns {Promise<boolean>}
 */
async function isInWishlist(userId, medicineId) {
  const [rows] = await pool.query(
    "SELECT id FROM wishlist WHERE user_id = ? AND medicine_id = ? LIMIT 1",
    [userId, medicineId],
  );
  return rows.length > 0;
}

module.exports = {
  add,
  remove,
  findByUser,
  isInWishlist,
};
