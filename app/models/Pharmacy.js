 /**
 * Pharmacy model.
 *
 * All database access for the pharmacies table lives here. Every query uses
 * parameterized statements (placeholders like `?`) via the mysql2 pool,
 * which prevents SQL injection.
 *
 * SECURITY / OWNERSHIP:
 * A pharmacy may be owned by a user with role 'pharmacy_owner' (linked via
 * pharmacies.owner_user_id). A single owner can own MULTIPLE pharmacies.
 *
 * Ownership is ALWAYS derived from the authenticated user's id (taken from
 * the session) and NEVER from a pharmacy id sent by the browser. The
 * following two methods are the ONLY ways to look up pharmacies for a user:
 *
 *   - findAllByOwnerUserId(userId) -> all pharmacies owned by the user.
 *   - findByIdAndOwner(pharmacyId, ownerUserId) -> a specific pharmacy, but
 *     ONLY if it actually belongs to that user (returns null otherwise).
 *
 * Every write operation in the dashboard must first resolve a pharmacy via
 * findByIdAndOwner() so a user can never touch another owner's pharmacy.
 */

const { pool } = require("../config/db");

/**
 * Return a single pharmacy by id, WITHOUT ownership scoping.
 * Used only by the platform admin (protected by protectAdmin). Normal
 * users/owners must use findByIdAndOwner(), which enforces ownership.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  const [rows] = await pool.query(
    `SELECT id, name, address, city, state, phone, status, owner_user_id, created_at, updated_at
     FROM pharmacies
     WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Return ALL pharmacies (for the platform admin), each joined with the
 * owner's name/email/status for display. Not ownership-scoped.
 * @returns {Promise<Array>}
 */
async function findAll() {
  const [rows] = await pool.query(
    `SELECT
       p.id,
       p.name,
       p.address,
       p.city,
       p.state,
       p.phone,
       p.status,
       p.owner_user_id,
       p.created_at,
       p.updated_at,
       u.name  AS owner_name,
       u.email AS owner_email,
       u.status AS owner_status
     FROM pharmacies p
     LEFT JOIN users u ON u.id = p.owner_user_id
     ORDER BY p.id ASC`,
  );
  return rows;
}

/**
 * Create a new pharmacy record.
 * @param {Object} data - { name, address, city, state, phone, status, owner_user_id }
 * @returns {Promise<Object>} The newly created pharmacy.
 */
async function create(data) {
  const [result] = await pool.query(
    `INSERT INTO pharmacies (name, address, city, state, phone, status, owner_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.address || null,
      data.city || null,
      data.state || null,
      data.phone || null,
      data.status || "pending",
      data.owner_user_id || null,
    ],
  );
  return findById(result.insertId);
}

/**
 * Update an existing pharmacy record.
 * @param {number} id
 * @param {Object} data - Same fields as create (status, owner_user_id, ...).
 * @returns {Promise<Object|null>} Updated pharmacy, or null if not found.
 */
async function update(id, data) {
  const [result] = await pool.query(
    `UPDATE pharmacies SET
       name = ?,
       address = ?,
       city = ?,
       state = ?,
       phone = ?,
       status = ?,
       owner_user_id = ?
     WHERE id = ?`,
    [
      data.name,
      data.address || null,
      data.city || null,
      data.state || null,
      data.phone || null,
      data.status || "pending",
      data.owner_user_id || null,
      id,
    ],
  );
  if (result.affectedRows === 0) {
    return findById(id);
  }
  return findById(id);
}

/**
 * Set a pharmacy's status to 'active', 'inactive', or 'pending'.
 * @param {number} id
 * @param {string} status - 'active' | 'inactive' | 'pending'
 * @returns {Promise<boolean>} true if a row was updated.
 */
async function setStatus(id, status) {
  const allowed = ["active", "inactive", "pending"];
  const value = allowed.includes(status) ? status : "active";
  const [result] = await pool.query(
    "UPDATE pharmacies SET status = ? WHERE id = ?",
    [value, id],
  );
  return result.affectedRows > 0;
}

/**
 * Return pharmacy status counts (total, active, inactive, pending).
 * Uses aggregate COUNT queries — no records loaded into memory.
 * @returns {Promise<Object>} { total, active, inactive, pending }
 */
async function statusCounts() {
  const [rows] = await pool.query(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'active'   THEN 1 ELSE 0 END) AS active,
       SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS inactive,
       SUM(CASE WHEN status = 'pending'  THEN 1 ELSE 0 END) AS pending
     FROM pharmacies`,
  );
  const row = rows[0] || {};
  return {
    total: Number(row.total || 0),
    active: Number(row.active || 0),
    inactive: Number(row.inactive || 0),
    pending: Number(row.pending || 0),
  };
}

/**
 * Return ALL pharmacies owned by the given user (any status).
 * Used to render the pharmacy selector on the dashboard.
 * @param {number} ownerUserId - authenticated user id (from the session)
 * @returns {Promise<Array>} pharmacy rows
 */
async function findAllByOwnerUserId(ownerUserId) {
  const [rows] = await pool.query(
    `SELECT id, name, address, city, state, phone, status, owner_user_id, created_at, updated_at
     FROM pharmacies
     WHERE owner_user_id = ?
     ORDER BY id ASC`,
    [ownerUserId],
  );
  return rows;
}

/**
 * Return a single pharmacy ONLY if it belongs to the given owner.
 * This is the authoritative ownership check used by every dashboard
 * operation. Returns null when the pharmacy does not exist OR is owned by
 * a different user, so callers can safely reject the request.
 *
 * @param {number} pharmacyId  - pharmacy id from the request (never trusted alone)
 * @param {number} ownerUserId - authenticated user id (from the session)
 * @returns {Promise<Object|null>}
 */
async function findByIdAndOwner(pharmacyId, ownerUserId) {
  const [rows] = await pool.query(
    `SELECT id, name, address, city, state, phone, status, owner_user_id, created_at, updated_at
     FROM pharmacies
     WHERE id = ? AND owner_user_id = ?
     LIMIT 1`,
    [pharmacyId, ownerUserId],
  );
  return rows.length > 0 ? rows[0] : null;
}

module.exports = {
  findById,
  findAll,
  create,
  update,
  setStatus,
  statusCounts,
  findAllByOwnerUserId,
  findByIdAndOwner,
};
