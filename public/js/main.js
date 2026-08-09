/**
 * Base browser-side JavaScript for Smart Pharmacy Price Comparison.
 *
 * Loaded on every page. Handles:
 *   1. Mobile navigation toggle (hamburger menu)
 *   2. Auto-dismissing flash messages after a short delay
 *   3. Active navigation link highlighting (accessible, imperative)
 *
 * Uses only vanilla JavaScript — no frameworks. No client-side copies of
 * backend business logic (pricing, availability, etc.).
 */

(function () {
  "use strict";

  /* ------------------------------------------------------------
     1. Mobile navigation toggle
     ------------------------------------------------------------ */
  function initMobileNav() {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.getElementById("main-nav");

    if (!toggle || !nav) return;

    toggle.addEventListener("click", function () {
      var isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    // Close the menu when a nav link is clicked (on mobile).
    nav.querySelectorAll("a, button").forEach(function (item) {
      item.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });

    // Close the menu when clicking outside of it.
    document.addEventListener("click", function (event) {
      var isInsideHeader = event.target.closest(".site-header");
      if (!isInsideHeader && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ------------------------------------------------------------
     2. Auto-dismiss flash messages
     ------------------------------------------------------------ */
  function initFlashAutoDismiss() {
    var alerts = document.querySelectorAll(".alert");
    alerts.forEach(function (alert) {
      var timeout = setTimeout(function () {
        alert.classList.add("alert-fade");
        // Remove from the DOM after the fade transition completes.
        setTimeout(function () {
          alert.remove();
        }, 300);
      }, 5000);
    });
  }

  /* ------------------------------------------------------------
     3. Active navigation link highlighting
     ------------------------------------------------------------ */
  function initActiveNav() {
    var currentPath = window.location.pathname;
    var links = document.querySelectorAll(".main-nav a[href]");

    links.forEach(function (link) {
      var href = link.getAttribute("href") || "";
      // Skip "compare" anchor and external/form links.
      if (href.indexOf("#") === 0) return;

      var isActive = false;
      if (href === "/") {
        isActive = currentPath === "/";
      } else {
        // Match the current path (or admin/pharmacy sub-sections).
        isActive =
          currentPath === href ||
          currentPath.indexOf(href + "/") === 0 ||
          currentPath.indexOf(href) === 0;
      }

      if (isActive) {
        link.classList.add("is-active");
        link.setAttribute("aria-current", "page");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initMobileNav();
    initFlashAutoDismiss();
    initActiveNav();
  });
})();
