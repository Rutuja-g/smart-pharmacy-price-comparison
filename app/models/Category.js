/**
 * Category model.
 *
 * All database access for the categories table lives here. Every query uses
 * parameterized statements (placeholders like `?`) via the mysql2 pool,
 * which prevents SQL injection.
 *
 * Categories are only ever added or edited (never deleted), because the
 * medicines table has a foreign key referencing categories (category_id).
 * Deleting a category could break that relationship.
 */

const { pool } = require("../config/db");

/**
 * Return all categories ordered by name.
 * @returns {Promise<Array>}
 */
async function findAll() {
  const [rows] = await pool.query(
    `SELECT id, name, description, created_at, updated_at
     FROM categories
     ORDER BY name ASC`,
  );
  return rows;
}

/**
 * Find a single category by id.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  const [rows] = await pool.query(
    "SELECT id, name, description, created_at, updated_at FROM categories WHERE id = ? LIMIT 1",
    [id],
  );
  return rows[0] || null;
}

/**
 * Find a category by exact name (case-insensitive) for uniqueness checks.
 * @param {string} name
 * @param {number} [excludeId] - optionally exclude a category id (for edits).
 * @returns {Promise<Object|null>}
 */
async function findByName(name, excludeId) {
  let rows;

  if (excludeId) {
    [rows] = await pool.query(
      "SELECT id FROM categories WHERE name = ? AND id <> ? LIMIT 1",
      [name, excludeId],
    );
  } else {
    [rows] = await pool.query(
      "SELECT id FROM categories WHERE name = ? LIMIT 1",
      [name],
    );
  }
  return rows[0] || null;
}

/**
 * Create a new category.
 * @param {Object} data - { name, description }
 * @returns {Promise<Object>} The newly created category.
 */
async function create(data) {
  const [result] = await pool.query(
    "INSERT INTO categories (name, description) VALUES (?, ?)",
    [data.name, data.description || null],
  );
  return findById(result.insertId);
}

/**
 * Update an existing category.
 * @param {number} id
 * @param {Object} data - { name, description }
 * @returns {Promise<Object|null>} Updated category, or null if not found.
 */
async function update(id, data) {
  await pool.query(
    "UPDATE categories SET name = ?, description = ? WHERE id = ?",
    [data.name, data.description || null, id],
  );
  // Whether or not values changed, the persisted row is the source of truth.
  return findById(id);
}

/**
 * Return all categories with a count of active medicines in each.
 * Used by the public "Browse Categories" page.
 * @returns {Promise<Array>} [{ id, name, description, medicine_count }]
 */
async function findActiveWithCounts() {
  const [rows] = await pool.query(
    `SELECT
       c.id,
       c.name,
       c.description,
       COUNT(m.id) AS medicine_count
     FROM categories c
     LEFT JOIN medicines m ON m.category_id = c.id AND m.status = 'active'
     GROUP BY c.id, c.name, c.description
     ORDER BY c.name ASC`,
  );
  return rows;
}

module.exports = {
  findAll,
  findById,
  findByName,
  create,
  update,
  findActiveWithCounts,
};
