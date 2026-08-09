/**
 * MySQL connection pool.
 *
 * A connection pool is preferred over a single connection because it can
 * handle many concurrent requests efficiently. All queries should use
 * parameterized/prepared statements to protect against SQL injection.
 *
 * The pool is created lazily and connection is NOT forced at app startup.
 * Use testDbConnection() to verify connectivity separately.
 */

const mysql = require("mysql2/promise");
const config = require("./env");

// Create a pool of connections using credentials from the environment.
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/**
 * Verify the database connection by running a simple query.
 * Returns a Promise that resolves on success or rejects on failure.
 */
async function testDbConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
    return { ok: true, message: "Database connection successful." };
  } finally {
    // Always release the connection back to the pool.
    connection.release();
  }
}

module.exports = {
  pool,
  testDbConnection,
};
