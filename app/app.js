/**
 * Express application configuration.
 *
 * This module builds and exports the configured Express app WITHOUT
 * starting the HTTP server. Keeping app setup separate from the server
 * listener makes the app easier to test and keeps concerns separated.
 */

const path = require("path");
const express = require("express");
const session = require("express-session");

const config = require("./config/env");
const indexRoutes = require("./routes/index");
const flashMiddleware = require("./utils/flash");
const { csrfProtection } = require("./middleware/csrf");

const app = express();

// ---------- Trust proxy ----------
// Set the number of proxies the app trusts. This is required for the
// session cookie to correctly detect HTTPS when the app runs behind a
// TLS-terminating reverse proxy (e.g. Nginx, Heroku, Render). Locally
// (no proxy) this has no effect and does not weaken HTTP development.
// Increase the number if you sit behind more than one proxy.
app.set("trust proxy", 1);

// ---------- View engine (EJS) ----------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ---------- Static files ----------
app.use(express.static(path.join(__dirname, "../public")));

// ---------- Body parsing ----------
// Express 4.16+ includes built-in JSON and URL-encoded body parsers.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- Session ----------
app.use(
  session({
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: config.session.cookieMaxAge,
      httpOnly: true,
      // SameSite=lax prevents CSRF by not sending the cookie on cross-site
      // requests, while still allowing top-level navigation.
      sameSite: "lax",
      // In production (HTTPS), only send cookies over secure connections.
      // When behind a TLS-terminating proxy this is detected via trust proxy.
      secure: config.isProduction,
    },
  }),
);

// ---------- CSRF protection ----------
// Applied after session so the token can be stored in/read from the session.
// It exposes `res.locals.csrfToken` for every view and validates all
// state-changing (POST/PUT/PATCH/DELETE) requests. GET requests are
// unaffected. Mounted before flash middleware so flash messages set during
// error handling still work.
app.use(csrfProtection);

// ---------- Flash messages + current user for views ----------
app.use(flashMiddleware);

// Make the authenticated user available to every view as `currentUser`.
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

// ---------- Routes ----------
app.use("/", indexRoutes);

// ---------- 404 handler ----------
app.use((req, res, next) => {
  res.status(404).render("error", {
    title: "Page Not Found",
    message: "The page you are looking for does not exist.",
    statusCode: 404,
  });
});

// ---------- Global error handler ----------
// Express recognizes this middleware by its 4-argument signature.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Log the full error server-side for diagnostics. This is NOT sent to the
  // user. Avoid logging the raw request body, which may contain passwords
  // or other secrets.
  console.error("Unhandled error:", {
    message: err.message,
    stack: config.env === "development" ? err.stack : undefined,
    code: err.code,
  });

  const statusCode = err.status || 500;

  // User-facing message: never expose DB internals, SQL, stack traces, or
  // credentials. For 4xx errors we may show err.message (already vetted by
  // the handler that created it); for 5xx we always show a generic message.
  const message =
    statusCode >= 500
      ? "An internal server error occurred. Please try again later."
      : err.message || "Something went wrong.";

  // If the client expects JSON (e.g. an API/fetch call), return JSON.
  if (req.accepts("json") && !req.accepts("html")) {
    return res.status(statusCode).json({
      error: message,
      statusCode,
    });
  }

  return res.status(statusCode).render("error", {
    title: statusCode >= 500 ? "Something went wrong" : "Error",
    message,
    statusCode,
  });
});

module.exports = app;
