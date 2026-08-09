/**
 * Authentication controller.
 *
 * Handles registration, login, logout, and the user profile page.
 * Uses bcryptjs for password hashing and express-session for
 * session-based authentication.
 */

const bcrypt = require("bcryptjs");
const User = require("../models/User");
const {
  isValidEmail,
  isValidName,
  isValidPassword,
  normalizeEmail,
  normalizeName,
} = require("../utils/validation");

// Cost factor for bcrypt hashing. Higher = slower but more secure.
const BCRYPT_ROUNDS = 10;

/** Render the registration form. */
function getRegister(req, res) {
  // If already logged in, no need to register again.
  if (req.session.user) return res.redirect("/profile");
  res.render("register", {
    title: "Register",
    appName: "Smart Pharmacy Price Comparison",
    values: {},
    errors: {},
  });
}

/** Handle registration form submission. */
async function postRegister(req, res) {
  const { name, email, password, passwordConfirm, phone, address } = req.body;

  const errors = {};
  const values = {
    name: normalizeName(name),
    email: normalizeEmail(email),
    phone: String(phone || "").trim(),
    address: String(address || "").trim(),
  };

  // ---- Validation ----
  if (!isValidName(values.name)) {
    errors.name = "Name must be between 2 and 100 characters.";
  }

  if (!email || !isValidEmail(values.email)) {
    errors.email = "Please enter a valid email address.";
  }

  if (!isValidPassword(password || "")) {
    errors.password = "Password must be at least 8 characters.";
  }

  if (password !== passwordConfirm) {
    errors.passwordConfirm = "Passwords do not match.";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).render("register", {
      title: "Register",
      appName: "Smart Pharmacy Price Comparison",
      values,
      errors,
    });
  }

  // ---- Check for duplicate email ----
  try {
    const existing = await User.findByEmail(values.email);
    if (existing) {
      errors.email = "An account with this email already exists.";
      return res.status(400).render("register", {
        title: "Register",
        appName: "Smart Pharmacy Price Comparison",
        values,
        errors,
      });
    }

    // ---- Hash the password (never store plain text) ----
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // New registrations default to role 'user'.
    const user = await User.create({
      name: values.name,
      email: values.email,
      password_hash,
      role: "user",
      phone: values.phone,
      address: values.address,
    });

    // Log the user in immediately after registration.
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    req.flash("success", "Account created successfully. Welcome!");
    return res.redirect("/profile");
  } catch (err) {
    console.error("Registration error:", err);
    req.flash(
      "error",
      "Something went wrong while creating your account. Please try again.",
    );
    return res.status(500).redirect("/register");
  }
}

/** Render the login form. */
function getLogin(req, res) {
  if (req.session.user) return res.redirect("/profile");
  res.render("login", {
    title: "Login",
    appName: "Smart Pharmacy Price Comparison",
    values: {},
    errors: {},
  });
}

/** Handle login form submission. */
async function postLogin(req, res) {
  const { email, password } = req.body;

  const errors = {};
  const values = { email: normalizeEmail(email) };

  // ---- Basic validation ----
  if (!values.email || !isValidEmail(values.email)) {
    errors.email = "Please enter a valid email address.";
  }
  if (!password) {
    errors.password = "Please enter your password.";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).render("login", {
      title: "Login",
      appName: "Smart Pharmacy Price Comparison",
      values,
      errors,
    });
  }

  try {
    // ---- Look up the user ----
    const user = await User.findByEmail(values.email);

    // Use a generic message whether the email OR password is wrong.
    // This prevents attackers from discovering which emails are registered.
    const invalidMsg = "Invalid email or password.";
    if (!user) {
      errors.general = invalidMsg;
      return res.status(401).render("login", {
        title: "Login",
        appName: "Smart Pharmacy Price Comparison",
        values,
        errors,
      });
    }

    // ---- Verify the password hash ----
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      errors.general = invalidMsg;
      return res.status(401).render("login", {
        title: "Login",
        appName: "Smart Pharmacy Price Comparison",
        values,
        errors,
      });
    }

    // ---- Reject deactivated (inactive) accounts ----
    // A deactivated user must NOT be able to log in, regardless of valid
    // credentials. The status is read from the DB (never from the browser).
    // IMPORTANT: We use the SAME generic message as for invalid credentials
    // so attackers cannot discover which emails are registered or which
    // accounts are deactivated (account enumeration).
    if (user.status === "inactive") {
      errors.general = invalidMsg;
      return res.status(401).render("login", {
        title: "Login",
        appName: "Smart Pharmacy Price Comparison",
        values,
        errors,
      });
    }

    // ---- Regenerate session to prevent session fixation ----
    req.session.regenerate((err) => {
      if (err) {
        console.error("Session regenerate error:", err);
        req.flash("error", "Could not start a session. Please try again.");
        return res.redirect("/login");
      }

      // Store only essential, non-sensitive user data in the session.
      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      };

      req.flash("success", `Welcome back, ${user.name}!`);
      return res.redirect("/profile");
    });
  } catch (err) {
    console.error("Login error:", err);
    req.flash("error", "Something went wrong. Please try again.");
    return res.redirect("/login");
  }
}

/** Handle logout. */
function logout(req, res, next) {
  req.session.destroy((err) => {
    if (err) return next(err);
    // Clear the session cookie from the browser.
    res.clearCookie("connect.sid");
    return res.redirect("/login");
  });
}

/** Render the authenticated user's profile. */
async function getProfile(req, res) {
  try {
    // Fetch fresh user data so the profile can show phone, address,
    // and member-since date (not just the minimal session snapshot).
    const user = await User.findById(req.session.user.id);
    if (!user) {
      req.flash("error", "Account not found. Please log in again.");
      return res.redirect("/login");
    }
    res.render("profile", {
      title: "My Profile",
      appName: "Smart Pharmacy Price Comparison",
      user,
    });
  } catch (err) {
    console.error("Profile error:", err);
    req.flash("error", "Could not load your profile. Please try again.");
    return res.redirect("/");
  }
}

module.exports = {
  getRegister,
  postRegister,
  getLogin,
  postLogin,
  logout,
  getProfile,
};
