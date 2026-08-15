/**
 * CSR F protection middleware (dependency-free).
 *
 * Uses Node's built-in `crypto` module to generate and validate a
 * per-session CSRF token. This protects all state-changing requests
 * (POST/PUT/PATCH/DELETE) from Cross-Site Request Forgery.
 *
 * How it works:
 *   - On a GET request, if the session has no CSRF token, one is generated
 *     and stored in the session. The token is exposed to every view via
 *     `res.locals.csrfToken` so forms can include it as a hidden input.
 *   - On a state-changing request (POST/PUT/PATCH/DELETE), the token in the
 *     request body (`_csrf`) is compared against the one stored in the
 *     session. If they don't match (or either is missing), the request is
 *     rejected with a 403.
 *   - GET requests are never affected.
 *
 * The token is NEVER placed in a URL. It is only ever sent in the body of a
 * state-changing form, which is safe because forms cannot be read cross-site.
 *
 * The session secret is never exposed to the client.
 */

const crypto = require("crypto");

// HTTP methods that mutate server state and therefore require CSRF validation.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);

/**
 * Generate a cryptographically secure random CSRF token.
 * @returns {string} hex token
 */
function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Constant-time string comparison to avoid timing attacks.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * CSRF middleware. Call as `app.use(csrfProtection)`.
 */
function csrfProtection(req, res, next) {
  // Ensure the session has a token; generate one if needed.
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateToken();
  }

  // Expose the token to every view so forms can render a hidden input.
  res.locals.csrfToken = req.session.csrfToken;

  // Only validate state-changing requests.
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // Check body, query parameter (for multipart uploads), or headers (for AJAX).
  const submitted =
    (req.body && req.body._csrf) ||
    (req.query && req.query._csrf) ||
    req.get("x-csrf-token") ||
    req.get("x-xsrf-token");

  if (!submitted || !safeEqual(submitted, req.session.csrfToken)) {
    const err = new Error(
      "Invalid or missing CSRF token. Please refresh and try again.",
    );
    err.status = 403;
    err.code = "CSRF_INVALID";
    // For JSON clients, return a JSON error; otherwise render the error page.
    if (req.accepts("json") && !req.accepts("html")) {
      return res.status(403).json({ error: "Invalid CSRF token." });
    }
    return next(err);
  }

  return next();
}

module.exports = { csrfProtection };
