# Production Code Review — Approved Fixes

- [x] 1. Fix routing order in `app/routes/index.js` so `/admin` is not captured by medicine `/:id`.
- [x] 2. Add missing CSS classes (`detail-card`, `detail-grid`, `detail-item`, `detail-label`, `detail-value`, `detail-text`, `badge-cheapest`) to `public/css/style.css`.
- [x] 3. Remove genuinely unused `app/utils/asyncHandler.js` (confirmed no imports/references).
- [x] 4. Remove unused `ownerId` variables in `pharmacyDashboardController` (getInventory, getAddInventory, postAddInventory).
- [x] 5. Simplify redundant `Medicine.update` and `Category.update` branches (identical behavior preserved).
- [x] 6. Simplify `isProduction` calculation in `app/config/env.js` (behavior preserved).
- [x] 7. Update `README.md` stale feature/roadmap statements.

### Verification

- [x] Syntax-check affected JS files (`env.js`, `Medicine.js`, `Category.js`, `pharmacyDashboardController.js`).
- [x] Confirmed the app boots (reaches the listen stage; port 3001 test instance stopped after verification).
- [x] Confirmed `/`, `/login`, `/register` return 200.
- [x] Final search for references to anything removed → `asyncHandler` has 0 references.

### Findings (pre-existing, NOT changed per scope)

- **Routing bug (pre-existing):** The public medicine routes in `app/routes/medicine.js` are defined as `/`, `/search`, `/:id`, `/categories/:id` and mounted at `/` in `app/routes/index.js`. As a result the intended URLs `/medicines`, `/medicines/search`, and `/medicines/:id` do NOT match (they return 404), while the same handlers are accidentally reachable at `/`, `/search`, and `/:id`. The `/medicines` prefix is missing from the medicine router. This was observed on a fresh instance and is independent of the changes above. Fixing it is out of scope for this review's approved change list.
- **DB connectivity:** The running app cannot reach MySQL with the configured credentials (`ER_ACCESS_DENIED_ERROR` for `root`), so DB-backed pages (e.g. `/medicines/:id`) redirect with an error. This is an environment/config matter, not a code defect.
