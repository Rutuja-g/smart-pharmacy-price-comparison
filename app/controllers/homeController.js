/**
 * Home controller.
 *
 * Handles the home page request. In this initial phase it simply renders
 * the home view with static placeholder data. Later phases will add
 * controllers for auth, medicines, pharmacies, wishlist, and admin.
 */

/**
 * GET /
 * Renders the home page.
 */
function renderHome(req, res) {
  res.render("home", {
    title: "Smart Pharmacy Price Comparison",
    appName: "Smart Pharmacy Price Comparison",
    tagline:
      "Compare medicine prices across pharmacies and find generic alternatives.",
    year: new Date().getFullYear(),
  });
}

module.exports = {
  renderHome,
};
