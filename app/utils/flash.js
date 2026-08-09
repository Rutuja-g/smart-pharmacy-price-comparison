/**
 * Flash message helper.
 *
 * Provides a simple session-based flash message mechanism so the
 * controller can set a one-time notice (e.g. "Invalid credentials")
 * and the view can display it on the next request.
 *
 * The app.js wires this up as both a `req.flash` method and a
 * `res.locals.flash` object exposed to every EJS view.
 */

/**
 * Attach a `req.flash` function and a `res.locals.flash` object.
 * Must be mounted as app-level middleware AFTER express-session.
 */
function flashMiddleware(req, res, next) {
  // Ensure the session has a flash storage area.
  if (!req.session) req.session = {};
  if (!req.session.flash) req.session.flash = {};

  // Expose current flash messages to views, then clear them.
  res.locals.flash = req.session.flash;
  req.session.flash = {};

  // Provide req.flash(type, message) to set a new message.
  req.flash = (type, message) => {
    if (!req.session.flash) req.session.flash = {};
    req.session.flash[type] = message;
  };

  next();
}

module.exports = flashMiddleware;
