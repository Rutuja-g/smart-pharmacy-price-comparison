const { test, expect } = require('@playwright/test');
const { pool } = require('../app/config/db');

const TEST_OWNER_EMAIL = 'test-owner@playwright.local';
const TEST_PHARMACY_NAME = 'Playwright Test Pharmacy';

let createdInventory;

async function findTestPharmacyMedicine() {
  const [rows] = await pool.query(
    `SELECT p.id AS pharmacy_id, m.id AS medicine_id, m.name AS medicine_name
     FROM pharmacies p
     INNER JOIN users u ON u.id = p.owner_user_id
     INNER JOIN medicines m ON m.status = 'active'
     WHERE p.name = ?
       AND u.email = ?
       AND NOT EXISTS (
         SELECT 1
         FROM pharmacy_inventory pi
         WHERE pi.pharmacy_id = p.id AND pi.medicine_id = m.id
       )
     ORDER BY m.id ASC
     LIMIT 1`,
    [TEST_PHARMACY_NAME, TEST_OWNER_EMAIL],
  );
  return rows[0] || null;
}

async function loginAsTestOwner(page) {
  const ownerPassword = process.env.PLAYWRIGHT_TEST_PASSWORD_OWNER;
  if (!ownerPassword) {
    throw new Error('PLAYWRIGHT_TEST_PASSWORD_OWNER environment variable is not set');
  }

  await page.goto('/login');
  await page.locator('#email').fill(TEST_OWNER_EMAIL);
  await page.locator('#password').fill(ownerPassword);
  await Promise.all([
    page.waitForURL(/\/profile$/),
    page.locator('form[action="/login"] button[type="submit"]').click(),
  ]);
}

test.afterEach(async () => {
  if (createdInventory) {
    await pool.query(
      'DELETE FROM pharmacy_inventory WHERE pharmacy_id = ? AND medicine_id = ?',
      [createdInventory.pharmacyId, createdInventory.medicineId],
    );
    createdInventory = undefined;
  }
});

test('Pharmacy dashboard requires pharmacy_owner authentication', async ({ page }) => {
  await page.goto('/pharmacy/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('.alert-error').nth(0)).toContainText(
    'You must be logged in to access that page.'
  );

  await page.goto('/pharmacy/inventory');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('.alert-error').nth(0)).toContainText(
    'You must be logged in to access that page.'
  );
});

test('Pharmacy owner can view their dashboard and rendered inventory', async ({ page }) => {
  try {
    // Login through the application form using the owner credential supplied
    // by the Playwright environment.
    await loginAsTestOwner(page);

    // The owner dashboard is rendered from pharmacies linked by owner_user_id.
    await page.goto('/pharmacy/dashboard');
    await expect(page.locator('h1')).toHaveText('Pharmacy Dashboard');

    const pharmacySelector = page.locator('form.pharmacy-selector select#pharmacyId');
    await expect(pharmacySelector).toBeVisible();
    const selectedPharmacyName = (await pharmacySelector.locator('option:checked').textContent()).trim();
    const totalMedicines = Number(
      (await page.locator('.stat-grid .stat-card').nth(0).locator('.stat-value').textContent()).trim(),
    );
    expect(selectedPharmacyName).not.toBe('');
    expect(totalMedicines).toBeGreaterThan(0);

    // Follow the real dashboard action rather than reconstructing its URL.
    const inventoryLink = page
      .locator('.page-actions a[href^="/pharmacy/inventory?pharmacyId="]')
      .filter({ hasText: 'View Inventory' });
    await expect(inventoryLink).toHaveCount(1);
    await inventoryLink.click();

    await expect(page.locator('h1')).toHaveText('Pharmacy Inventory');
    await expect(page.locator('.page-subtitle')).toContainText(selectedPharmacyName);

    // Validate actual data rendered from pharmacy_inventory joined to medicines.
    const inventoryRows = page.locator('table tbody tr');
    await expect(inventoryRows).toHaveCount(totalMedicines);

    const firstRow = inventoryRows.first();
    await expect(firstRow.locator('td').nth(0).locator('a[href^="/medicines/"]')).toHaveText(/\S+/);
    await expect(firstRow.locator('td').nth(3)).toHaveText(/^\d+$/);
    await expect(firstRow.locator('td').nth(4)).toHaveText(/\d+\.\d{2}/);
    await expect(firstRow.locator('td').nth(5).locator('.badge')).toHaveText(
      /^(Available|Out of Stock)$/,
    );
  } finally {
    const logoutButton = page.locator('#main-nav form[action="/logout"] button[type="submit"]');
    if (await logoutButton.count()) {
      await Promise.all([page.waitForURL(/\/login$/), logoutButton.click()]);
    }
  }
});

test('Pharmacy owner can add, update, and re-add inventory through the UI', async ({ page }) => {
  const medicine = await findTestPharmacyMedicine();
  expect(medicine, 'an active medicine outside the test pharmacy inventory').not.toBeNull();

  const initialStock = '12';
  const initialPrice = '17.45';
  const updatedStock = '28';
  const updatedPrice = '19.75';
  const duplicateStock = '31';
  const duplicatePrice = '21.25';

  createdInventory = {
    pharmacyId: medicine.pharmacy_id,
    medicineId: medicine.medicine_id,
  };

  try {
    await loginAsTestOwner(page);

    await page.goto(`/pharmacy/inventory?pharmacyId=${medicine.pharmacy_id}`);
    await expect(page.locator('h1')).toHaveText('Pharmacy Inventory');

    await page.locator('a[href^="/pharmacy/inventory/add?pharmacyId="]').click();
    await expect(page.locator('h1')).toHaveText('Add Inventory');
    await expect(page.locator(`#medicineId option[value="${medicine.medicine_id}"]`)).toHaveCount(1);

    const addForm = page.locator('form.inventory-form');
    await addForm.locator('#medicineId').selectOption(String(medicine.medicine_id));
    await addForm.locator('#stock').fill(initialStock);
    await addForm.locator('#price').fill(initialPrice);
    await Promise.all([
      page.waitForURL(new RegExp(`/pharmacy/inventory\\?pharmacyId=${medicine.pharmacy_id}$`)),
      addForm.locator('button[type="submit"]').click(),
    ]);

    await expect(page.locator('.alert-success')).toContainText('Inventory record added successfully.');

    const medicineRow = page
      .locator(`a[href="/medicines/${medicine.medicine_id}"]`)
      .locator('xpath=ancestor::tr');
    await expect(medicineRow).toHaveCount(1);
    await expect(medicineRow.locator('form.stock-form input[name="stock"]')).toHaveValue(initialStock);
    await expect(medicineRow.locator('form.price-form input[name="price"]')).toHaveValue(initialPrice);
    await expect(medicineRow.locator('.badge')).toHaveText('Available');

    const stockForm = medicineRow.locator('form.stock-form');
    await stockForm.locator('input[name="stock"]').fill(updatedStock);
    await Promise.all([
      page.waitForURL(new RegExp(`/pharmacy/inventory\\?pharmacyId=${medicine.pharmacy_id}$`)),
      stockForm.locator('button[type="submit"]').click(),
    ]);
    await expect(page.locator('.alert-success')).toContainText(
      `Stock updated to ${updatedStock} for "${medicine.medicine_name}".`,
    );

    const updatedMedicineRow = page
      .locator(`a[href="/medicines/${medicine.medicine_id}"]`)
      .locator('xpath=ancestor::tr');
    const priceForm = updatedMedicineRow.locator('form.price-form');
    await priceForm.locator('input[name="price"]').fill(updatedPrice);
    await Promise.all([
      page.waitForURL(new RegExp(`/pharmacy/inventory\\?pharmacyId=${medicine.pharmacy_id}$`)),
      priceForm.locator('button[type="submit"]').click(),
    ]);
    await expect(page.locator('.alert-success')).toContainText(
      `Price updated to ${updatedPrice} for "${medicine.medicine_name}".`,
    );

    const pricedMedicineRow = page
      .locator(`a[href="/medicines/${medicine.medicine_id}"]`)
      .locator('xpath=ancestor::tr');
    await expect(pricedMedicineRow.locator('form.stock-form input[name="stock"]')).toHaveValue(updatedStock);
    await expect(pricedMedicineRow.locator('form.price-form input[name="price"]')).toHaveValue(updatedPrice);

    await page.locator('a[href^="/pharmacy/inventory/add?pharmacyId="]').click();
    const duplicateAddForm = page.locator('form.inventory-form');
    await duplicateAddForm.locator('#medicineId').selectOption(String(medicine.medicine_id));
    await duplicateAddForm.locator('#stock').fill(duplicateStock);
    await duplicateAddForm.locator('#price').fill(duplicatePrice);
    await Promise.all([
      page.waitForURL(new RegExp(`/pharmacy/inventory\\?pharmacyId=${medicine.pharmacy_id}$`)),
      duplicateAddForm.locator('button[type="submit"]').click(),
    ]);

    await expect(page.locator('.alert-success')).toContainText(
      'Existing inventory record updated successfully.',
    );

    const duplicateMedicineRow = page
      .locator(`a[href="/medicines/${medicine.medicine_id}"]`)
      .locator('xpath=ancestor::tr');
    await expect(duplicateMedicineRow).toHaveCount(1);
    await expect(duplicateMedicineRow.locator('form.stock-form input[name="stock"]')).toHaveValue(duplicateStock);
    await expect(duplicateMedicineRow.locator('form.price-form input[name="price"]')).toHaveValue(duplicatePrice);
  } finally {
    const logoutButton = page.locator('#main-nav form[action="/logout"] button[type="submit"]');
    if (await logoutButton.count()) {
      await Promise.all([page.waitForURL(/\/login$/), logoutButton.click()]);
    }
  }
});

test('Pharmacy owner can toggle inventory availability and restore original state through the UI', async ({ page }) => {
  try {
    await loginAsTestOwner(page);

    await page.goto('/pharmacy/inventory');
    await expect(page.locator('h1')).toHaveText('Pharmacy Inventory');

    const row = page.locator('table tbody tr').first();
    await expect(row).toHaveCount(1);

    const initialBadgeText = (await row.locator('.badge').textContent()).trim();
    const isInitiallyAvailable = initialBadgeText === 'Available';

    const toggleButtonText = isInitiallyAvailable ? 'Mark Out' : 'Mark Available';
    const expectedToggledBadgeText = isInitiallyAvailable ? 'Out of Stock' : 'Available';
    const restoreButtonText = isInitiallyAvailable ? 'Mark Available' : 'Mark Out';

    // 1. Toggle availability via the UI button
    const toggleButton = row.locator('form[action$="/availability"] button').filter({ hasText: toggleButtonText });
    await Promise.all([
      page.waitForNavigation(),
      toggleButton.click(),
    ]);

    // 2. Verify UI reflects the changed availability state
    await expect(page.locator('.alert-success')).toBeVisible();
    const updatedRow = page.locator('table tbody tr').first();
    await expect(updatedRow.locator('.badge')).toHaveText(expectedToggledBadgeText);

    // 3. Toggle back to original state
    const restoreButton = updatedRow.locator('form[action$="/availability"] button').filter({ hasText: restoreButtonText });
    await Promise.all([
      page.waitForNavigation(),
      restoreButton.click(),
    ]);

    // 4. Verify original state is restored
    await expect(page.locator('.alert-success')).toBeVisible();
    const restoredRow = page.locator('table tbody tr').first();
    await expect(restoredRow.locator('.badge')).toHaveText(initialBadgeText);
  } finally {
    const logoutButton = page.locator('#main-nav form[action="/logout"] button[type="submit"]');
    if (await logoutButton.count()) {
      await Promise.all([page.waitForURL(/\/login$/), logoutButton.click()]);
    }
  }
});
