-- =============================================
-- Migration: Add users.status column (Phase 10)
--
-- Adds a `status` column to the `users` table so the platform admin
-- can activate/deactivate user accounts. When a user is 'inactive',
-- they cannot log in and their existing session is treated as invalid.
--
-- SAFE TO RUN: column is ADD-ONLY. Adding a NOT NULL column with a
-- DEFAULT back-fills all existing rows with 'active' (no data loss).
-- =============================================

USE smart_pharmacy;

-- Add the status column (idempotent-safe: use IF NOT EXISTS semantics
-- by checking information_schema first).
SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'smart_pharmacy'
    AND TABLE_NAME   = 'users'
    AND COLUMN_NAME  = 'status'
);

SET @ddl := IF(
  @col_exists = 0,
  "ALTER TABLE users
     ADD COLUMN status ENUM('active','inactive') NOT NULL DEFAULT 'active'
     AFTER role,
   ADD KEY idx_users_status (status),
   ADD KEY idx_users_role (role)",
  "SELECT 'users.status already exists; skipping.' AS message"
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
