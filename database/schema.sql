-- =============================================
-- Smart Pharmacy Price Comparison - Database Schema
-- MySQL 8.0
--
-- Phase 2: Normalized relational schema for the platform.
--
-- CONTAINS THE FOLLOWING TABLES:
--   users                 - platform users (customer, pharmacy owner, admin)
--   categories            - medicine categories
--   pharmacies            - pharmacy records & their owner relationship
--   medicines             - medicine catalog (brand & generic records)
--   pharmacy_inventory    - pharmacy-specific stock + price for a medicine
--   generic_alternatives  - self-referencing medicine alternatives
--   wishlist              - user-to-medicine wishlist
--
-- =============================================

CREATE DATABASE IF NOT EXISTS smart_pharmacy
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE smart_pharmacy;

-- =============================================
-- USERS
-- Holds authentication credentials and role info.
-- Roles are an ENUM to support role-based access control.
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(190)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  role          ENUM('user','pharmacy_owner','admin') NOT NULL DEFAULT 'user',
  status        ENUM('active','inactive') NOT NULL DEFAULT 'active',
  phone         VARCHAR(20)   NULL,
  address       VARCHAR(255)  NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_status (status)
) ENGINE=InnoDB;

-- =============================================
-- CATEGORIES
-- Medicine categories (e.g. Analgesics, Antibiotics, Vitamins).
-- =============================================
CREATE TABLE IF NOT EXISTS categories (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_categories_name (name)
) ENGINE=InnoDB;

-- =============================================
-- PHARMACIES
-- Pharmacy records. 'owner_user_id' links a pharmacy to a
-- pharmacy_owner user for role-based management.
-- =============================================
CREATE TABLE IF NOT EXISTS pharmacies (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  address       VARCHAR(255) NULL,
  city          VARCHAR(100) NULL,
  state         VARCHAR(100) NULL,
  phone         VARCHAR(20)  NULL,
  status        ENUM('active','inactive','pending') NOT NULL DEFAULT 'pending',
  owner_user_id INT UNSIGNED NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_pharmacies_owner
    FOREIGN KEY (owner_user_id)
    REFERENCES users (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  KEY idx_pharmacies_owner (owner_user_id)
) ENGINE=InnoDB;

-- =============================================
-- MEDICINES
-- Unified medicine catalog. Both branded medicines and their
-- generic counterparts are stored here as normal rows.
-- Price is NOT stored here; it lives in pharmacy_inventory.
-- =============================================
CREATE TABLE IF NOT EXISTS medicines (
  id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name                 VARCHAR(190) NOT NULL,          -- display / searchable name
  generic_name         VARCHAR(190) NULL,              -- active ingredient / generic name
  category_id          INT UNSIGNED NULL,
  description          TEXT          NULL,
  dosage_form          VARCHAR(50)  NULL,              -- e.g. Tablet, Capsule, Syrup
  strength             VARCHAR(50)  NULL,              -- e.g. 500mg
  prescription_required TINYINT(1) NOT NULL DEFAULT 0, -- 0 = OTC, 1 = Rx
  status               ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_medicines_category
    FOREIGN KEY (category_id)
    REFERENCES categories (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

-- Indexes to support fast medicine search (the core feature).
  KEY idx_medicines_name (name),
  KEY idx_medicines_generic_name (generic_name),
  KEY idx_medicines_category (category_id),
  -- FULLTEXT index on the primary searchable text fields. The Phase 6
  -- search uses parameterized LIKE partial matching (which leverages the
  -- b-tree indexes above for leading-prefix matches). This FULLTEXT index
  -- is available as a complementary optimization for full-text relevance
  -- scoring if broader search is added later.
  FULLTEXT KEY ft_medicines_search (name, generic_name)
) ENGINE=InnoDB;

-- =============================================
-- PHARMACY INVENTORY
-- Pharmacy-specific stock and price for a medicine.
-- The UNIQUE(pharmacy_id, medicine_id) prevents duplicate
-- stock rows and doubles as a composite index for
-- cross-pharmacy price comparison queries.
-- =============================================
CREATE TABLE IF NOT EXISTS pharmacy_inventory (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pharmacy_id   INT UNSIGNED NOT NULL,
  medicine_id   INT UNSIGNED NOT NULL,
  stock_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  availability  TINYINT(1)   NOT NULL DEFAULT 1,       -- 1 = in stock, 0 = unavailable
  selling_price DECIMAL(10,2) NOT NULL,                -- price is pharmacy-specific
  last_updated  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_inventory_stock_nonneg CHECK (stock_quantity >= 0),
  CONSTRAINT chk_inventory_price_positive CHECK (selling_price > 0),

  CONSTRAINT fk_inventory_pharmacy
    FOREIGN KEY (pharmacy_id)
    REFERENCES pharmacies (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_inventory_medicine
    FOREIGN KEY (medicine_id)
    REFERENCES medicines (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  UNIQUE KEY uk_inventory_pharmacy_medicine (pharmacy_id, medicine_id),
  KEY idx_inventory_medicine (medicine_id),
  KEY idx_inventory_price (selling_price)
) ENGINE=InnoDB;

-- =============================================
-- GENERIC ALTERNATIVES
-- Self-referencing relationship between medicine records.
-- 'medicine_id' is the original medicine; 'alternative_medicine_id'
-- points to another medicine row that is an alternative (usually generic).
-- The UNIQUE pair prevents duplicate relationship rows.
-- =============================================
CREATE TABLE IF NOT EXISTS generic_alternatives (
  id                       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  medicine_id              INT UNSIGNED NOT NULL,      -- original (branded) medicine
  alternative_medicine_id  INT UNSIGNED NOT NULL,      -- the generic / alternative
  relation_type            ENUM('generic','brand','substitute') NOT NULL DEFAULT 'generic',
  notes                    VARCHAR(255) NULL,
  created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_alt_medicine
    FOREIGN KEY (medicine_id)
    REFERENCES medicines (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_alt_alternative
    FOREIGN KEY (alternative_medicine_id)
    REFERENCES medicines (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  -- Prevent duplicate alternative links and reverse duplicates.
  UNIQUE KEY uk_alt_pair (medicine_id, alternative_medicine_id),
  KEY idx_alt_medicine (medicine_id),
  KEY idx_alt_alternative (alternative_medicine_id)
) ENGINE=InnoDB;

-- =============================================
-- WISHLIST
-- Tracks a user's saved medicines. UNIQUE(user_id, medicine_id)
-- prevents the same item being added twice by the same user.
-- =============================================
CREATE TABLE IF NOT EXISTS wishlist (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  medicine_id INT UNSIGNED NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_wishlist_user
    FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_wishlist_medicine
    FOREIGN KEY (medicine_id)
    REFERENCES medicines (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  UNIQUE KEY uk_wishlist_user_medicine (user_id, medicine_id),
  KEY idx_wishlist_user (user_id)
) ENGINE=InnoDB;
