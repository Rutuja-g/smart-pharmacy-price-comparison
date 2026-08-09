-- =============================================
-- Smart Pharmacy Price Comparison - Seed Data
-- MySQL 8.0
--
-- FICTIONAL sample data ONLY. No real personal or
-- sensitive medical information is used.
--
-- Designed to demonstrate:
--   1. Multiple pharmacies selling the same medicine at different prices.
--   2. A medicine available at multiple pharmacies.
--   3. A medicine out of stock at some pharmacies.
--   4. A medicine out of stock everywhere.
--   5. A medicine with multiple generic alternatives.
--   6. A generic alternative cheaper than the brand medicine.
--   7. Multiple medicine categories.
--   8. Users with roles: user, pharmacy_owner, and admin.
--
-- Run AFTER schema.sql (against the same database).
-- =============================================

USE smart_pharmacy;

-- =============================================
-- USERS
-- Password hashes are placeholders (bcrypt-style hash strings).
-- role 'admin', 'pharmacy_owner', 'user' are all represented.
-- =============================================
INSERT INTO users (id, name, email, password_hash, role, phone, address) VALUES
(1, 'Admin User',   'admin@example.com',   '$2a$10$placeholderhashadmin1234567890abc', 'admin',           '+1-555-0100', '1 Admin Plaza'),
(2, 'Owner Alice',  'alice@citycare.com',  '$2a$10$placeholderhashalice1234567890abcd',  'pharmacy_owner',  '+1-555-0101', '2 Main Street'),
(3, 'Owner Bob',    'bob@greenmed.com',    '$2a$10$placeholderhashbob1234567890abcd',   'pharmacy_owner',  '+1-555-0102', '3 Oak Avenue'),
(4, 'Owner Carol',  'carol@healthplus.com','$2a$10$placeholderhashcarol1234567890abcd', 'pharmacy_owner',  '+1-555-0103', '4 Pine Road'),
(5, 'Regular User', 'user@example.com',    '$2a$10$placeholderhashuser1234567890abcd',  'user',            '+1-555-0104', '5 Elm Street');

-- =============================================
-- CATEGORIES
-- =============================================
INSERT INTO categories (id, name, description) VALUES
(1, 'Analgesics',    'Pain relievers and fever reducers.'),
(2, 'Antibiotics',   'Medicines used to treat bacterial infections.'),
(3, 'Antihistamines','Medicines for allergy relief.'),
(4, 'Gastrointestinal','Medicines for digestive issues.'),
(5, 'Vitamins & Supplements', 'Nutritional supplements and multivitamins.');

-- =============================================
-- PHARMACIES
-- Each pharmacy is linked to a pharmacy_owner via owner_user_id.
-- =============================================
INSERT INTO pharmacies (id, name, address, city, state, phone, status, owner_user_id) VALUES
(1, 'CityCare Pharmacy',   '100 Market Blvd',  'Springfield', 'IL', '+1-555-0201', 'active',   2),
(2, 'GreenMed Pharmacy',   '200 Lakeview Dr', 'Springfield', 'IL', '+1-555-0202', 'active',   3),
(3, 'HealthPlus Pharmacy', '300 Central Ave', 'Springfield', 'IL', '+1-555-0203', 'active',   4),
(4, 'Downtown Pharmacy',   '400 River St',    'Springfield', 'IL', '+1-555-0204', 'inactive', 2);

-- =============================================
-- MEDICINES
-- Price is NOT stored here. Both brand and generic medicines
-- are normal rows. Generic alternatives are linked separately.
--
-- Brand medicines: Ibuprofen MR (id 1), Amoxicillin (id 4),
--   Cetirizine (id 7), Omeprazole (id 10), Vitamin C (id 13)
-- Generic medicines: Ibuprofen (id 2,3), Amoxicillin GP (id 5,6),
--   Cetirizine GP (id 8,9), Omeprazole GP (id 11,12), Vitamin C GP (id 14)
-- =============================================
INSERT INTO medicines (id, name, generic_name, category_id, description, dosage_form, strength, prescription_required, status) VALUES
-- Ibuprofen brand + generics
(1,  'Advil',               'Ibuprofen', 1, 'Brand ibuprofen for pain and fever.',       'Tablet', '200mg', 0, 'active'),
(2,  'Ibuprofen (Generic)', 'Ibuprofen', 1, 'Generic ibuprofen 200mg.',                   'Tablet', '200mg', 0, 'active'),
(3,  'Ibuprofen (Generic) 400', 'Ibuprofen', 1, 'Generic ibuprofen 400mg.',               'Tablet', '400mg', 0, 'active'),
-- Amoxicillin brand + generics
(4,  'Amoxil',              'Amoxicillin', 2, 'Brand amoxicillin antibiotic.',           'Capsule', '500mg', 1, 'active'),
(5,  'Amoxicillin (Generic)', 'Amoxicillin', 2, 'Generic amoxicillin 500mg.',            'Capsule', '500mg', 1, 'active'),
(6,  'Amoxicillin Suspension (Generic)', 'Amoxicillin', 2, 'Generic amoxicillin suspension.', 'Suspension', '250mg/5ml', 1, 'active'),
-- Cetirizine brand + generics
(7,  'Zyrtec',              'Cetirizine', 3, 'Brand cetirizine for allergies.',          'Tablet', '10mg', 0, 'active'),
(8,  'Cetirizine (Generic)', 'Cetirizine', 3, 'Generic cetirizine 10mg.',                'Tablet', '10mg', 0, 'active'),
(9,  'Cetirizine Syrup (Generic)', 'Cetirizine', 3, 'Generic cetirizine syrup.',         'Syrup', '5mg/5ml', 0, 'active'),
-- Omeprazole brand + generics
(10, 'Prilosec',            'Omeprazole', 4, 'Brand omeprazole for acid reflux.',        'Capsule', '20mg', 0, 'active'),
(11, 'Omeprazole (Generic)', 'Omeprazole', 4, 'Generic omeprazole 20mg.',                 'Capsule', '20mg', 0, 'active'),
(12, 'Omeprazole (Generic) 40', 'Omeprazole', 4, 'Generic omeprazole 40mg.',              'Capsule', '40mg', 0, 'active'),
-- Vitamin C
(13, 'Nature C',            'Ascorbic Acid', 5, 'Vitamin C supplement.',                 'Tablet', '500mg', 0, 'active'),
(14, 'Vitamin C (Generic)', 'Ascorbic Acid', 5, 'Generic vitamin C 500mg.',               'Tablet', '500mg', 0, 'active'),
-- Paracetamol brand + generics (Phase 6 search demo)
(15, 'Panadol',             'Paracetamol', 1, 'Brand paracetamol for pain and fever.',   'Tablet', '500mg', 0, 'active'),
(16, 'Paracetamol (Generic)', 'Paracetamol', 1, 'Generic paracetamol 500mg.',            'Tablet', '500mg', 0, 'active'),
(17, 'Paracetamol Extra (Generic)', 'Paracetamol + Caffeine', 1, 'Generic paracetamol with caffeine.', 'Tablet', '500mg/65mg', 0, 'active'),
(18, 'Paracetamol Syrup (Generic)', 'Paracetamol', 1, 'Generic paracetamol syrup for children.', 'Syrup', '120mg/5ml', 0, 'active');

-- =============================================
-- PHARMACY INVENTORY
-- Demonstrates price comparison scenarios:
--   - Advil (id 1) sold at 3 pharmacies at different prices.
--   - Amoxil (id 4) available at 2 pharmacies.
--   - Zyrtec (id 7) out of stock at pharmacy 2 (availability=0).
--   - Prilosec (id 10) out of stock everywhere (no inventory rows).
--   - Generic alternatives cheaper than brands (e.g. Ibuprofen vs Advil).
-- =============================================
INSERT INTO pharmacy_inventory (pharmacy_id, medicine_id, stock_quantity, availability, selling_price) VALUES
-- Advil (brand ibuprofen) across multiple pharmacies at different prices
(1, 1, 50, 1, 12.99),
(2, 1, 30, 1, 11.50),
(3, 1, 20, 1, 13.49),
-- Generic ibuprofen cheaper than brand
(1, 2, 100, 1, 6.49),
(2, 2, 80, 1, 5.99),
(3, 2, 60, 1, 6.99),
(1, 3, 40, 1, 8.99),
(2, 3, 25, 1, 8.49),
-- Amoxil (brand amoxicillin) available at 2 pharmacies
(1, 4, 15, 1, 18.99),
(2, 4, 10, 1, 20.49),
-- Generic amoxicillin
(1, 5, 90, 1, 9.99),
(2, 5, 70, 1, 10.49),
(3, 5, 50, 1, 9.79),
(1, 6, 30, 1, 7.99),
-- Zyrtec (brand cetirizine) - out of stock at pharmacy 2
(1, 7, 25, 1, 15.99),
(2, 7, 0,  0, 14.99),   -- unavailable at GreenMed
(3, 7, 18, 1, 16.49),
-- Generic cetirizine
(1, 8, 110, 1, 4.99),
(2, 8, 95, 1, 4.49),
(3, 8, 85, 1, 5.29),
(1, 9, 20, 1, 3.99),
-- Omeprazole generics (brand Prilosec intentionally has NO inventory = out of stock everywhere)
(1, 11, 60, 1, 8.99),
(2, 11, 45, 1, 9.49),
(3, 11, 55, 1, 8.79),
(1, 12, 35, 1, 12.99),
-- Vitamin C brand + generic
(1, 13, 70, 1, 10.99),
(2, 13, 50, 1, 11.49),
(3, 13, 40, 1, 10.49),
(1, 14, 120, 1, 3.99),
(2, 14, 100, 1, 3.49),
(3, 14, 90, 1, 3.79),
-- Paracetamol brand + generics (Phase 6)
(1, 15, 45, 1, 8.49),
(2, 15, 35, 1, 7.99),
(3, 15, 25, 1, 8.99),
(1, 16, 130, 1, 2.99),
(2, 16, 110, 1, 2.49),
(3, 16, 95, 1, 2.79),
(1, 17, 40, 1, 3.49),
(2, 17, 30, 1, 3.29),
(3, 17, 20, 1, 3.79),
(1, 18, 60, 1, 4.49),
(2, 18, 50, 1, 4.19);

-- =============================================
-- GENERIC ALTERNATIVES
-- medicine_id = original (brand); alternative_medicine_id = generic.
-- Demonstrates multiple alternatives for one medicine (Amoxicillin)
-- and a cheaper generic for Ibuprofen/Advil.
-- =============================================
INSERT INTO generic_alternatives (medicine_id, alternative_medicine_id, relation_type, notes) VALUES
(1, 2, 'generic', 'Standard generic equivalent of Advil 200mg.'),
(1, 3, 'generic', 'Higher strength generic ibuprofen option (400mg).'),
(4, 5, 'generic', 'Standard generic capsule equivalent of Amoxil 500mg.'),
(4, 6, 'generic', 'Generic suspension form for patients who prefer liquid.'),
(7, 8, 'generic', 'Generic tablet equivalent of Zyrtec 10mg.'),
(7, 9, 'generic', 'Generic syrup form of cetirizine.'),
(10, 11, 'generic', 'Generic capsule equivalent of Prilosec 20mg.'),
(10, 12, 'generic', 'Higher strength generic omeprazole option (40mg).'),
(13, 14, 'generic', 'Generic ascorbic acid equivalent.'),
(15, 16, 'generic', 'Standard generic tablet equivalent of Panadol 500mg.'),
(15, 18, 'generic', 'Generic syrup form of paracetamol for children.');

-- =============================================
-- WISHLIST
-- =============================================
INSERT INTO wishlist (user_id, medicine_id) VALUES
(5, 1),   -- Regular User saved Advil
(5, 4),   -- Regular User saved Amoxil
(5, 10),  -- Regular User saved Prilosec
(5, 14);  -- Regular User saved generic Vitamin C
