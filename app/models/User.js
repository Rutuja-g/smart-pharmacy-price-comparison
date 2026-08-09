/**
 * User model.
 *
 * All database access for the users table lives here. Every query uses
 * parameterized statements (placeholders like `?`) via the mysql2 pool,
 * which prevents SQL injection.
 *
 * NOTE: password_hash is never returned to the controller/view layer
 * except through internal methods that explicitly need it (login check).
 */

const { pool } = require("../config/db");

/**
 * Create a new user record.
 * @param {Object} userData - { name, email, password_hash, phone, address, role }
 * @returns {Promise<Object>} The new user row (id, name, email, role, ...)
 */
async function create(userData) {
  const { name, email, password_hash, phone, address, role } = userData;

  const [result] = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, phone, address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      name,
      email,
      password_hash,
      role || "user",
      phone || null,
      address || null,
    ],
  );

  // Return the freshly created user (without the password hash).
  return findById(result.insertId);
}

/**
 * Find a user by their unique email address.
 * @param {string} email
 * @returns {Promise<Object|null>} User row (INCLUDING password_hash) or null.
 */
async function findByEmail(email) {
  const [rows] = await pool.query(
    "SELECT * FROM users WHERE email = ? LIMIT 1",
    [email],
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Find a user by their primary key.
 * @param {number} id
 * @returns {Promise<Object|null>} User row WITHOUT password_hash, or null.
 */
async function findById(id) {
  const [rows] = await pool.query(
    `SELECT id, name, email, role, status, phone, address, created_at, updated_at
     FROM users WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Return all users (newest first), WITHOUT password hashes.
 * Used by the admin user-management page.
 * @returns {Promise<Array>}
 */
async function findAll() {
  const [rows] = await pool.query(
    `SELECT id, name, email, role, status, phone, address, created_at, updated_at
     FROM users
     ORDER BY created_at DESC, id DESC`,
  );
  return rows;
}

/**
 * Return all users with a given role (used to build the pharmacy-owner
 * assignment dropdown). Only safe, known roles are accepted.
 * @param {string} role - 'user' | 'pharmacy_owner' | 'admin'
 * @returns {Promise<Array>}
 */
async function findByRole(role) {
  const allowed = ["user", "pharmacy_owner", "admin"];
  if (!allowed.includes(role)) return [];
  const [rows] = await pool.query(
    `SELECT id, name, email, role, status, phone, created_at
     FROM users
     WHERE role = ?
     ORDER BY name ASC`,
    [role],
  );
  return rows;
}

/**
 * Set a user's status to 'active' or 'inactive'.
 * @param {number} id
 * @param {string} status - 'active' | 'inactive'
 * @returns {Promise<boolean>} true if a row was updated.
 */
async function setStatus(id, status) {
  const [result] = await pool.query(
    "UPDATE users SET status = ? WHERE id = ?",
    [status === "inactive" ? "inactive" : "active", id],
  );
  return result.affectedRows > 0;
}

/**
 * Count the total number of users.
 * @returns {Promise<number>}
 */
async function countAll() {
  const [rows] = await pool.query("SELECT COUNT(*) AS total FROM users");
  return Number(rows[0].total || 0);
}

/**
 * Count the number of active users.
 * @returns {Promise<number>}
 */
async function countActive() {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS total FROM users WHERE status = 'active'",
  );
  return Number(rows[0].total || 0);
}

/**
 * Count the number of ACTIVE admin users, optionally excluding one id.
 * Used to enforce the "cannot deactivate the last active admin" rule.
 * @param {number} [excludeId] - a user id to exclude from the count.
 * @returns {Promise<number>}
 */
async function countActiveAdminsExcept(excludeId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM users
     WHERE role = 'admin' AND status = 'active' AND id <> ?`,
    [excludeId || 0],
  );
  return Number(rows[0].total || 0);
}

module.exports = {
  create,
  findByEmail,
  findById,
  findAll,
  findByRole,
  setStatus,
  countAll,
  countActive,
  countActiveAdminsExcept,
};
