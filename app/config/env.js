/**
 * Centralized environment configuration.
 *
 * All environment variables are read once here and exposed as a single
 * config object. This keeps secrets out of the codebase and provides a
 * single place to adjust defaults for local development.
 *
 * IMPORTANT: This module must be imported before any other module that
 * relies on process.env values, because dotenv is loaded here.
 */

const path = require("path");
const dotenv = require("dotenv");

// Load variables from the .env file at the project root into process.env.
// The path is resolved relative to this file (app/config -> project root).
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const env = process.env.NODE_ENV || "development";
const isProduction = env === "production";

/**
 * Session secret.
 *
 * In production the app MUST NOT start with a missing or weak session
 * secret, because that would allow an attacker to forge/decrypt session
 * cookies. We resolve the secret from the SESSION_SECRET environment
 * variable and fail fast if it is missing or too short.
 *
 * In development, if SESSION_SECRET is not set, we log a clear warning
 * explaining how to configure it (rather than silently using a known
 * insecure value). For local development you can set:
 *
 *   SESSION_SECRET=some_long_random_string
 *
 * in your `.env` file. The secret is never printed to logs.
 */
const sessionSecret = process.env.SESSION_SECRET || "";

if (isProduction && (!sessionSecret || sessionSecret.length < 32)) {
  throw new Error(
    "Production requires a SESSION_SECRET of at least 32 characters. " +
      "Set SESSION_SECRET in your .env file and restart the server.",
  );
}

if (!sessionSecret) {
  // We should be in development. Warn loudly but allow the app to boot so
  // local development stays frictionless. The user must set SESSION_SECRET
  // before deploying to production.
  console.warn(
    "[env] WARNING: SESSION_SECRET is not set. " +
      "This is an insecure configuration. " +
      "Set SESSION_SECRET in your .env file (e.g. a long random string) " +
      "before deploying to production.",
  );
}

module.exports = {
  env,
  isProduction,

  port: parseInt(process.env.PORT, 10) || 3000,

  session: {
    secret: sessionSecret,
    // Session cookie options. In production, secure cookies should be used.
    cookieMaxAge: 1000 * 60 * 60 * 24, // 24 hours
  },

  db: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "smart_pharmacy",
  },
};
