-- =============================================
-- Migration: Add CHECK constraints to pharmacy_inventory (Phase 11)
--
-- Enforces at the database level that:
--   - selling_price  > 0   (no free/negative prices)
--   - stock_quantity >= 0  (no negative stock)
--
-- These mirror the application-level validation in
-- `app/controllers/pharmacyDashboardController.js` (parsePrice /
-- parseStock) and form a defense-in-depth safety net so that invalid
-- data can never be written even if a route is misconfigured.
--
-- SAFE TO RUN against an existing database. It is idempotent: it first
-- checks information_schema and only adds a constraint if it does not
-- already exist. If any existing rows violate a constraint, the ALTER
-- will fail — inspect and fix those rows first.
-- =============================================

USE smart_pharmacy;

-- Add CHECK (stock_quantity >= 0) if not present.
SET @chk_stock := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = 'smart_pharmacy'
    AND TABLE_NAME = 'pharmacy_inventory'
    AND CONSTRAINT_NAME = 'chk_inventory_stock_nonneg'
);

SET @ddl_stock := IF(
  @chk_stock = 0,
  "ALTER TABLE pharmacy_inventory
     ADD CONSTRAINT chk_inventory_stock_nonneg CHECK (stock_quantity >= 0)",
  "SELECT 'chk_inventory_stock_nonneg already exists; skipping.' AS message"
);

PREPARE stmt_stock FROM @ddl_stock;
EXECUTE stmt_stock;
DEALLOCATE PREPARE stmt_stock;

-- Add CHECK (selling_price > 0) if not present.
SET @chk_price := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = 'smart_pharmacy'
    AND TABLE_NAME = 'pharmacy_inventory'
    AND CONSTRAINT_NAME = 'chk_inventory_price_positive'
);

SET @ddl_price := IF(
  @chk_price = 0,
  "ALTER TABLE pharmacy_inventory
     ADD CONSTRAINT chk_inventory_price_positive CHECK (selling_price > 0)",
  "SELECT 'chk_inventory_price_positive already exists; skipping.' AS message"
);

PREPARE stmt_price FROM @ddl_price;
EXECUTE stmt_price;
DEALLOCATE PREPARE stmt_price;
