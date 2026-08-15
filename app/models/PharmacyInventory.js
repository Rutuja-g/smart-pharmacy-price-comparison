/**
 * PharmacyInventory model.
 *
 * All database access for the pharmacy_inventory table, plus the JOINs
 * needed for the core price & availability comparison feature, lives here.
 *
 * This model is responsible ONLY for read-side comparison queries. It does
 * NOT manage pharmacies themselves (that will be a dedicated Pharmacy model
 * in a later phase). Pharmacy data needed for comparison is retrieved via
 * JOINs from pharmacy_inventory -> pharmacies.
 *
 * Every query uses parameterized statements (`?` placeholders) via the
 * mysql2 pool, which prevents SQL injection.
 *
 * IMPORTANT BUSINESS RULES (enforced at the SQL level):
 *   - The cheapest pharmacy is selected ONLY from pharmacies that are
 *     'active', have availability = 1, AND have stock_quantity > 0.
 *   - Out-of-stock pharmacies are never treated as the cheapest option.
 *   - If a medicine has no available pharmacies, no cheapest is returned.
 */

const { pool } = require("../config/db");
const { escapeLike } = require("../utils/validation");

/**
 * Serialize a DECIMAL selling_price (returned as a string by mysql2) into a
 * JavaScript float so the view can format it cleanly and compare values.
 * @param {Object} row
 * @returns {Object}
 */
function serialize(row) {
  if (!row) return null;
  return {
    ...row,
    selling_price:
      row.selling_price !== null && row.selling_price !== undefined
        ? Number(row.selling_price)
        : null,
    stock_quantity: Number(row.stock_quantity || 0),
    availability: row.availability === 1 || row.availability === true,
  };
}

/**
 * Get a medicine's inventory across all ACTIVE pharmacies.
 *
 * Returns one row per pharmacy-inventory record JOINed with the pharmacy.
 * A pharmacy that has no inventory row for the medicine simply won't appear
 * here (it is treated as "not sold here"). Out-of-stock pharmacies that DO
 * have an inventory row (availability = 0) appear with availability=false
 * so the UI can still show them as "Out of Stock".
 *
 * @param {number} medicineId
 * @returns {Promise<Array>} [{ pharmacy_id, pharmacy_name, city, state, availability, stock_quantity, selling_price, last_updated }]
 */
async function getMedicineInventory(medicineId) {
  const [rows] = await pool.query(
    `SELECT
       p.id      AS pharmacy_id,
       p.name    AS pharmacy_name,
       p.address AS pharmacy_address,
       p.city    AS pharmacy_city,
       p.state   AS pharmacy_state,
       pi.stock_quantity,
       pi.availability,
       pi.selling_price,
       pi.last_updated
     FROM pharmacy_inventory pi
     INNER JOIN pharmacies p ON p.id = pi.pharmacy_id
     WHERE pi.medicine_id = ?
       AND p.status = 'active'
     ORDER BY pi.availability DESC, pi.selling_price ASC`,
    [medicineId],
  );
  return rows.map(serialize);
}

/**
 * Get the cheapest AVAILABLE pharmacy for a medicine.
 *
 * The cheapest is deliberately restricted to pharmacies that are:
 *   - 'active'
 *   - availability = 1 (in stock)
 *   - stock_quantity > 0 (physically have stock)
 *
 * ORDER BY selling_price ASC LIMIT 1 returns the single lowest price among
 * those available pharmacies. Out-of-stock rows are naturally excluded by
 * the WHERE clause, so an out-of-stock pharmacy can NEVER be selected.
 *
 * @param {number} medicineId
 * @returns {Promise<Object|null>} The cheapest available pharmacy, or null
 *   when there is no available pharmacy.
 */
async function getCheapestAvailablePharmacy(medicineId) {
  const [rows] = await pool.query(
    `SELECT
       p.id      AS pharmacy_id,
       p.name    AS pharmacy_name,
       p.address AS pharmacy_address,
       p.city    AS pharmacy_city,
       p.state   AS pharmacy_state,
       pi.stock_quantity,
       pi.selling_price,
       pi.last_updated
     FROM pharmacy_inventory pi
     INNER JOIN pharmacies p ON p.id = pi.pharmacy_id
     WHERE pi.medicine_id = ?
       AND p.status = 'active'
       AND pi.availability = 1
       AND pi.stock_quantity > 0
     ORDER BY pi.selling_price ASC
     LIMIT 1`,
    [medicineId],
  );
  return rows.length > 0 ? serialize(rows[0]) : null;
}

/**
 * Get the generic alternatives for a medicine.
 *
 * Uses the generic_alternatives self-referencing relationship:
 *   generic_alternatives.medicine_id = original medicine
 *   generic_alternatives.alternative_medicine_id = the generic/alternative
 *
 * JOINs medicines to resolve the alternative's name/generic_name/details.
 * Only active alternatives are returned. No duplication: each alternative
 * medicine row maps 1:1 to a generic_alternatives row (enforced by the
 * UNIQUE uk_alt_pair constraint).
 *
 * @param {number} medicineId
 * @returns {Promise<Array>} Array of alternative medicine objects.
 */
async function getGenericAlternatives(medicineId) {
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
       ga.relation_type,
       ga.notes
     FROM generic_alternatives ga
     INNER JOIN medicines m ON m.id = ga.alternative_medicine_id
     LEFT JOIN categories c ON c.id = m.category_id
     WHERE ga.medicine_id = ?
       AND m.status = 'active'
     ORDER BY ga.created_at ASC`,
    [medicineId],
  );
  return rows.map((row) => ({
    ...row,
    prescription_required:
      row.prescription_required === 1 || row.prescription_required === true,
  }));
}

/**
 * Get the pharmacy inventory for each generic alternative of a medicine.
 *
 * This is a single JOIN query across generic_alternatives -> medicines ->
 * pharmacy_inventory -> pharmacies. It returns, for each alternative, the
 * availability and price across active pharmacies. The result is grouped in
 * JavaScript by alternative medicine so the view can render one comparison
 * block per alternative.
 *
 * Medicine duplicate rows are avoided because pharmacy_inventory has a
 * UNIQUE(pharmacy_id, medicine_id) constraint — each medicine has at most
 * one inventory row per pharmacy.
 *
 * @param {number} medicineId
 * @returns {Promise<Array>} [{ medicine_id, name, ...pharmacy inventory rows }]
 */
async function getGenericAlternativeInventory(medicineId) {
  const [rows] = await pool.query(
    `SELECT
       m.id          AS medicine_id,
       m.name        AS alternative_name,
       m.generic_name,
       m.strength,
       m.dosage_form,
       ga.relation_type,
       ga.notes,
       p.id          AS pharmacy_id,
       p.name        AS pharmacy_name,
       p.city        AS pharmacy_city,
       p.state       AS pharmacy_state,
       pi.stock_quantity,
       pi.availability,
       pi.selling_price,
       pi.last_updated
     FROM generic_alternatives ga
     INNER JOIN medicines m ON m.id = ga.alternative_medicine_id
     INNER JOIN pharmacy_inventory pi ON pi.medicine_id = m.id
     INNER JOIN pharmacies p ON p.id = pi.pharmacy_id
     WHERE ga.medicine_id = ?
       AND m.status = 'active'
       AND p.status = 'active'
     ORDER BY m.id ASC, pi.availability DESC, pi.selling_price ASC`,
    [medicineId],
  );

  // Group rows by alternative medicine and serialize each inventory row.
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.medicine_id)) {
      grouped.set(row.medicine_id, {
        medicine_id: row.medicine_id,
        name: row.alternative_name,
        generic_name: row.generic_name,
        strength: row.strength,
        dosage_form: row.dosage_form,
        relation_type: row.relation_type,
        notes: row.notes,
        inventory: [],
      });
    }
    grouped.get(row.medicine_id).inventory.push(serialize(row));
  }

  return Array.from(grouped.values());
}

/**
 * Serialize an inventory row for the dashboard (numeric conversions).
 * @param {Object} row
 * @returns {Object}
 */
function serializeDashboard(row) {
  if (!row) return null;
  return {
    ...row,
    selling_price:
      row.selling_price !== null && row.selling_price !== undefined
        ? Number(row.selling_price)
        : null,
    stock_quantity: Number(row.stock_quantity || 0),
    availability: row.availability === 1 || row.availability === true,
  };
}

/**
 * Add (or update) an inventory record for a pharmacy.
 *
 * Uses a TRANSACTION to keep the ownership/medicine validation and the
 * insert atomic. The medicine must exist and be active. The pharmacy is
 * already assumed to be owned by the authenticated user (verified by the
 * controller via findByIdAndOwner before calling this method).
 *
 * Because of the UNIQUE(pharmacy_id, medicine_id) constraint, if a row
 * already exists for this medicine it is updated (stock + price) rather
 * than duplicated.
 *
 * @param {number} pharmacyId - verified-owned pharmacy id
 * @param {number} medicineId - medicine to add
 * @param {number} stock      - non-negative stock quantity
 * @param {number} price      - positive selling price
 * @returns {Promise<Object>} { created: boolean, inventoryId }
 */
async function addInventory(pharmacyId, medicineId, stock, price) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verify the medicine exists and is active.
    const [meds] = await connection.query(
      "SELECT id FROM medicines WHERE id = ? AND status = 'active' LIMIT 1",
      [medicineId],
    );
    if (meds.length === 0) {
      await connection.rollback();
      const err = new Error(
        "The selected medicine does not exist or is inactive.",
      );
      err.code = "INVALID_MEDICINE";
      throw err;
    }

    // Availability is derived from stock: available when stock > 0.
    const availability = Number(stock) > 0 ? 1 : 0;

    // INSERT ... ON DUPLICATE KEY UPDATE handles both the new-record and
    // "already exists" cases on the UNIQUE(pharmacy_id, medicine_id) pair.
    const [result] = await connection.query(
      `INSERT INTO pharmacy_inventory
         (pharmacy_id, medicine_id, stock_quantity, availability, selling_price)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         stock_quantity = VALUES(stock_quantity),
         availability = VALUES(availability),
         selling_price = VALUES(selling_price)`,
      [pharmacyId, medicineId, stock, availability, price],
    );

    await connection.commit();

    const created = result.affectedRows === 1;
    // On an update, result.insertId may be 0, so look up the row id.
    let inventoryId = result.insertId;
    if (!inventoryId) {
      const [rows] = await connection.query(
        "SELECT id FROM pharmacy_inventory WHERE pharmacy_id = ? AND medicine_id = ? LIMIT 1",
        [pharmacyId, medicineId],
      );
      inventoryId = rows.length > 0 ? rows[0].id : null;
    }

    return { created, inventoryId };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Update the stock quantity for a pharmacy's inventory record.
 *
 * Uses a TRANSACTION so the stock update and the derived availability
 * update are atomic. Availability is recalculated from the new stock:
 *   - stock becomes 0        -> availability = 0 (out of stock)
 *   - stock becomes > 0      -> availability = 1 (in stock)
 *
 * The WHERE clause scopes the update to the specific pharmacy, so a
 * pharmacy can never modify another pharmacy's inventory row.
 *
 * @param {number} pharmacyId  - verified-owned pharmacy id
 * @param {number} inventoryId - inventory row id
 * @param {number} stock       - non-negative stock quantity
 * @returns {Promise<Object|null>} updated row, or null if not found
 */
async function updateStock(pharmacyId, inventoryId, stock) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const availability = Number(stock) > 0 ? 1 : 0;

    const [result] = await connection.query(
      `UPDATE pharmacy_inventory
       SET stock_quantity = ?, availability = ?
       WHERE id = ? AND pharmacy_id = ?`,
      [stock, availability, inventoryId, pharmacyId],
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return null;
    }

    const [rows] = await connection.query(
      `SELECT
         pi.id,
         pi.pharmacy_id,
         pi.medicine_id,
         m.name        AS medicine_name,
         m.generic_name,
         m.strength,
         pi.stock_quantity,
         pi.availability,
         pi.selling_price,
         pi.last_updated
       FROM pharmacy_inventory pi
       INNER JOIN medicines m ON m.id = pi.medicine_id
       WHERE pi.id = ?`,
      [inventoryId],
    );

    await connection.commit();
    return rows.length > 0 ? serializeDashboard(rows[0]) : null;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Update the selling price for a pharmacy's inventory record.
 *
 * The update is scoped to the specific pharmacy + inventory row, so a
 * pharmacy can never modify another pharmacy's price.
 *
 * @param {number} pharmacyId  - verified-owned pharmacy id
 * @param {number} inventoryId - inventory row id
 * @param {number} price       - positive selling price
 * @returns {Promise<Object|null>} updated row, or null if not found
 */
async function updatePrice(pharmacyId, inventoryId, price) {
  const [result] = await pool.query(
    `UPDATE pharmacy_inventory
     SET selling_price = ?
     WHERE id = ? AND pharmacy_id = ?`,
    [price, inventoryId, pharmacyId],
  );

  if (result.affectedRows === 0) return null;

  const [rows] = await pool.query(
    `SELECT
       pi.id,
       pi.pharmacy_id,
       pi.medicine_id,
       m.name        AS medicine_name,
       m.generic_name,
       m.strength,
       pi.stock_quantity,
       pi.availability,
       pi.selling_price,
       pi.last_updated
     FROM pharmacy_inventory pi
     INNER JOIN medicines m ON m.id = pi.medicine_id
     WHERE pi.id = ?`,
    [inventoryId],
  );
  return rows.length > 0 ? serializeDashboard(rows[0]) : null;
}

/**
 * Manually set the availability flag for a pharmacy's inventory record.
 *
 * Note: availability is normally derived from stock automatically. This
 * method exists to satisfy the "deliberate manual availability mechanism"
 * requirement. The update is scoped to the pharmacy + inventory row.
 *
 * @param {number} pharmacyId  - verified-owned pharmacy id
 * @param {number} inventoryId - inventory row id
 * @param {boolean} available  - desired availability
 * @returns {Promise<Object|null>} updated row, or null if not found
 */
async function setAvailability(pharmacyId, inventoryId, available) {
  const availability = available ? 1 : 0;
  const [result] = await pool.query(
    `UPDATE pharmacy_inventory
     SET availability = ?
     WHERE id = ? AND pharmacy_id = ?`,
    [availability, inventoryId, pharmacyId],
  );

  if (result.affectedRows === 0) return null;

  const [rows] = await pool.query(
    `SELECT
       pi.id,
       pi.pharmacy_id,
       pi.medicine_id,
       m.name        AS medicine_name,
       m.generic_name,
       m.strength,
       pi.stock_quantity,
       pi.availability,
       pi.selling_price,
       pi.last_updated
     FROM pharmacy_inventory pi
     INNER JOIN medicines m ON m.id = pi.medicine_id
     WHERE pi.id = ?`,
    [inventoryId],
  );
  return rows.length > 0 ? serializeDashboard(rows[0]) : null;
}

/**
 * List a pharmacy's inventory, optionally filtered by keyword and status.
 *
 * JOINs medicines so the UI can show medicine details. Supports:
 *   - keyword search across medicine name, generic name, and strength
 *   - availability filter: 'all' | 'available' | 'out'
 *
 * The query is scoped to the given pharmacy id.
 *
 * @param {number} pharmacyId
 * @param {Object} opts - { search, filter }
 * @returns {Promise<Array>}
 */
async function findByPharmacy(pharmacyId, opts = {}) {
  const search = String(opts.search || "").trim();
  const filter = String(opts.filter || "all");

  const where = ["pi.pharmacy_id = ?"];
  const params = [pharmacyId];

  if (search.length > 0) {
    const pattern = `%${escapeLike(search)}%`;
    where.push(
      "(m.name LIKE ? ESCAPE '\\\\' OR m.generic_name LIKE ? ESCAPE '\\\\' OR m.strength LIKE ? ESCAPE '\\\\')",
    );
    params.push(pattern, pattern, pattern);
  }

  if (filter === "available") {
    where.push("pi.availability = 1");
  } else if (filter === "out") {
    where.push("pi.availability = 0");
  }

  const [rows] = await pool.query(
    `SELECT
       pi.id,
       pi.pharmacy_id,
       pi.medicine_id,
       m.name        AS medicine_name,
       m.generic_name,
       m.category_id,
       c.name        AS category_name,
       m.dosage_form,
       m.strength,
       m.prescription_required,
       pi.stock_quantity,
       pi.availability,
       pi.selling_price,
       pi.last_updated
     FROM pharmacy_inventory pi
     INNER JOIN medicines m ON m.id = pi.medicine_id
     LEFT JOIN categories c ON c.id = m.category_id
     WHERE ${where.join(" AND ")}
     ORDER BY m.name ASC`,
    params,
  );
  return rows.map(serializeDashboard);
}

/**
 * Count the total number of inventory records across all pharmacies.
 * @returns {Promise<number>}
 */
async function countAll() {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS total FROM pharmacy_inventory",
  );
  return Number(rows[0].total || 0);
}

/**
 * Count the number of available inventory records (availability = 1).
 * @returns {Promise<number>}
 */
async function countAvailable() {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS total FROM pharmacy_inventory WHERE availability = 1",
  );
  return Number(rows[0].total || 0);
}

/**
 * Count the number of out-of-stock inventory records (availability = 0).
 * @returns {Promise<number>}
 */
async function countOutOfStock() {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS total FROM pharmacy_inventory WHERE availability = 0",
  );
  return Number(rows[0].total || 0);
}

/**
 * Compute summary statistics for a pharmacy's inventory.
 *
 * Returns counts used by the dashboard cards:
 *   - total_medicines   : number of inventory rows
 *   - available         : rows with availability = 1
 *   - out_of_stock      : rows with availability = 0
 *   - recently_updated  : the 5 most recently updated inventory rows
 *
 * @param {number} pharmacyId
 * @returns {Promise<Object>}
 */
async function getSummary(pharmacyId) {
  const [counts] = await pool.query(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN availability = 1 THEN 1 ELSE 0 END) AS available,
       SUM(CASE WHEN availability = 0 THEN 1 ELSE 0 END) AS out_of_stock
     FROM pharmacy_inventory
     WHERE pharmacy_id = ?`,
    [pharmacyId],
  );

  const [recent] = await pool.query(
    `SELECT
       pi.id,
       pi.medicine_id,
       m.name        AS medicine_name,
       pi.stock_quantity,
       pi.availability,
       pi.selling_price,
       pi.last_updated
     FROM pharmacy_inventory pi
     INNER JOIN medicines m ON m.id = pi.medicine_id
     WHERE pi.pharmacy_id = ?
     ORDER BY pi.last_updated DESC
     LIMIT 5`,
    [pharmacyId],
  );

  const row = counts[0] || {};
  return {
    total_medicines: Number(row.total || 0),
    available: Number(row.available || 0),
    out_of_stock: Number(row.out_of_stock || 0),
    recently_updated: recent.map(serializeDashboard),
  };
}

module.exports = {
  getMedicineInventory,
  getCheapestAvailablePharmacy,
  getGenericAlternatives,
  getGenericAlternativeInventory,
  addInventory,
  updateStock,
  updatePrice,
  setAvailability,
  findByPharmacy,
  countAll,
  countAvailable,
  countOutOfStock,
  getSummary,
};
