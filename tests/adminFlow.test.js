const { test, expect } = require('@playwright/test');
const { pool } = require('../app/config/db');

const TEST_ADMIN_EMAIL = 'test-admin@playwright.local';
const TEST_USER_EMAIL = 'test-user@playwright.local';
const TEST_PHARMACY_NAME = 'Playwright Test Pharmacy';

async function loginAsTestAdmin(page) {
  const adminPassword = process.env.PLAYWRIGHT_TEST_PASSWORD_ADMIN;
  if (!adminPassword) {
    throw new Error('PLAYWRIGHT_TEST_PASSWORD_ADMIN environment variable is not set');
  }

  await page.goto('/login');
  await page.locator('#email').fill(TEST_ADMIN_EMAIL);
  await page.locator('#password').fill(adminPassword);
  await Promise.all([
    page.waitForURL(/\/profile$/),
    page.locator('form[action="/login"] button[type="submit"]').click(),
  ]);
}

async function expectMetric(page, label) {
  const metric = page.locator('.stat-card').filter({
    has: page.locator('.stat-label', { hasText: label }),
  });
  await expect(metric).toHaveCount(1);
  await expect(metric.locator('.stat-label')).toHaveText(label);
  await expect(metric.locator('.stat-value')).toHaveText(/^\d+$/);
}

async function getTargetUserRow(page) {
  const targetUserRow = page.locator('table tbody tr').filter({
    hasText: TEST_USER_EMAIL,
  });
  await expect(targetUserRow).toHaveCount(1);
  return targetUserRow;
}

async function getRenderedUserStatus(userRow) {
  const status = userRow.locator('.badge-success, .badge-danger');
  await expect(status).toHaveCount(1);
  return (await status.textContent()).trim().toLowerCase();
}

async function setUserStatusThroughUi(page, desiredStatus) {
  const targetUserRow = await getTargetUserRow(page);
  const currentStatus = await getRenderedUserStatus(targetUserRow);
  if (currentStatus === desiredStatus) return;

  const action = desiredStatus === 'active' ? 'activate' : 'deactivate';
  const actionForm = targetUserRow.locator(`form[action$="/${action}"]`);
  await expect(actionForm).toHaveCount(1);
  await Promise.all([
    page.waitForURL(/\/admin\/users$/),
    actionForm.locator('button[type="submit"]').click(),
  ]);
  await expect(page.locator('.alert-success')).toContainText(`was ${action}d.`);

  const updatedTargetUserRow = await getTargetUserRow(page);
  await expect(await getRenderedUserStatus(updatedTargetUserRow)).toBe(desiredStatus);
}

async function snapshotNonTargetUserStatuses() {
  const [rows] = await pool.query(
    'SELECT id, email, status FROM users WHERE email <> ? ORDER BY id ASC',
    [TEST_USER_EMAIL],
  );
  return rows;
}

async function getTestPharmacyRow(page) {
  const pharmacyRow = page.locator('table tbody tr').filter({
    hasText: TEST_PHARMACY_NAME,
  });
  await expect(pharmacyRow).toHaveCount(1);
  return pharmacyRow;
}

async function openTestPharmacyEditForm(page) {
  if (!/\/admin\/pharmacies$/.test(page.url())) {
    await page.goto('/admin/pharmacies');
  }
  const pharmacyRow = await getTestPharmacyRow(page);
  const editLink = pharmacyRow.locator('a[href^="/admin/pharmacies/"][href$="/edit"]');
  await expect(editLink).toHaveCount(1);
  await editLink.click();
  await expect(page.locator('h1')).toHaveText('Edit Pharmacy');
  return page.locator('form.auth-form');
}

async function getEditablePharmacyValues(form) {
  return {
    name: await form.locator('#name').inputValue(),
    address: await form.locator('#address').inputValue(),
    city: await form.locator('#city').inputValue(),
    state: await form.locator('#state').inputValue(),
    phone: await form.locator('#phone').inputValue(),
    status: await form.locator('#status').inputValue(),
    ownerUserId: await form.locator('#owner_user_id').inputValue(),
  };
}

async function saveTestPharmacyPhone(page, phone) {
  const form = await openTestPharmacyEditForm(page);
  await form.locator('#phone').fill(phone);
  await Promise.all([
    page.waitForURL(/\/admin\/pharmacies$/),
    form.locator('button[type="submit"]').click(),
  ]);
  await expect(page.locator('.alert-success')).toContainText(
    `Pharmacy "${TEST_PHARMACY_NAME}" was updated.`,
  );
  const pharmacyRow = await getTestPharmacyRow(page);
  await expect(pharmacyRow.locator('.table-sub')).toHaveText(phone || '—');
}

async function setTestPharmacyStatusThroughUi(page, desiredStatus) {
  if (!/\/admin\/pharmacies$/.test(page.url())) {
    await page.goto('/admin/pharmacies');
  }
  const pharmacyRow = await getTestPharmacyRow(page);
  const actionForm = pharmacyRow.locator(`form[action$="/${desiredStatus}"]`);
  await expect(actionForm).toHaveCount(1);
  await Promise.all([
    page.waitForURL(/\/admin\/pharmacies$/),
    actionForm.locator('button[type="submit"]').click(),
  ]);
  await expect(page.locator('.alert-success')).toContainText(
    `Pharmacy "${TEST_PHARMACY_NAME}" is now ${desiredStatus}.`,
  );

  const form = await openTestPharmacyEditForm(page);
  await expect(form.locator('#status')).toHaveValue(desiredStatus);
}

async function snapshotSeededPharmacies() {
  const [rows] = await pool.query(
    `SELECT id, name, address, city, state, phone, status, owner_user_id
     FROM pharmacies
     WHERE id IN (1, 2, 3, 4)
     ORDER BY id ASC`,
  );
  return rows;
}

async function snapshotSeededMedicines() {
  const [rows] = await pool.query(
    `SELECT id, name, generic_name, category_id, description, dosage_form, strength, prescription_required, status
     FROM medicines
     WHERE name NOT LIKE 'Playwright Test Medicine%'
     ORDER BY id ASC`,
  );
  return rows;
}

async function cleanupTestMedicines() {
  await pool.query("DELETE FROM medicines WHERE name LIKE 'Playwright Test Medicine%'");
}

async function snapshotSeededCategories() {
  const [rows] = await pool.query(
    `SELECT id, name, description
     FROM categories
     WHERE name NOT LIKE 'Playwright Test Category%'
     ORDER BY id ASC`,
  );
  return rows;
}

async function cleanupTestCategories() {
  await pool.query("DELETE FROM categories WHERE name LIKE 'Playwright Test Category%'");
}

test('Admin can view dashboard metrics and management lists', async ({ page }) => {
  try {
    await loginAsTestAdmin(page);

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/dashboard$/);
    await expect(page.locator('h1')).toHaveText('Admin Dashboard');

    await page.goto('/admin/dashboard');
    await expect(page.locator('h1')).toHaveText('Admin Dashboard');
    for (const label of [
      'Total Users',
      'Active Users',
      'Total Pharmacies',
      'Active Pharmacies',
      'Pending Pharmacies',
      'Total Medicines',
      'Active Medicines',
      'Total Inventory Records',
      'Available',
      'Out of Stock',
    ]) {
      await expectMetric(page, label);
    }

    await page.goto('/admin/users');
    await expect(page.locator('h1')).toHaveText('Manage Users');
    const userRows = page.locator('table tbody tr');
    await expect(userRows).not.toHaveCount(0);
    const adminRow = userRows.filter({ hasText: TEST_ADMIN_EMAIL });
    await expect(adminRow).toHaveCount(1);
    await expect(adminRow.locator('.role-admin')).toHaveText('admin');
    await expect(adminRow.locator('.badge-success')).toHaveText('Active');

    await page.goto('/admin/pharmacies');
    await expect(page.locator('h1')).toHaveText('Manage Pharmacies');
    const pharmacyRows = page.locator('table tbody tr');
    await expect(pharmacyRows).not.toHaveCount(0);
    await expect(pharmacyRows.filter({ hasText: 'Playwright Test Pharmacy' })).toHaveCount(1);

    await page.goto('/admin/medicines');
    await expect(page.locator('h1')).toHaveText('Manage Medicines');
    await expect(page.locator('table tbody tr')).not.toHaveCount(0);

    await page.goto('/admin/categories');
    await expect(page.locator('h1')).toHaveText('Manage Categories');
    await expect(page.getByRole('heading', { name: 'Existing Categories' })).toHaveCount(1);
    await expect(page.locator('table tbody tr')).not.toHaveCount(0);
  } finally {
    const logoutButton = page.locator('#main-nav form[action="/logout"] button[type="submit"]');
    if (await logoutButton.count()) {
      await Promise.all([page.waitForURL(/\/login$/), logoutButton.click()]);
    }
  }
});

test('Admin can change and restore the dedicated test user status through the UI', async ({ page }) => {
  let originalStatus;
  let otherUsersBefore;

  try {
    await loginAsTestAdmin(page);
    await page.goto('/admin/users');
    await expect(page.locator('h1')).toHaveText('Manage Users');

    const targetUserRow = await getTargetUserRow(page);
    originalStatus = await getRenderedUserStatus(targetUserRow);
    otherUsersBefore = await snapshotNonTargetUserStatuses();

    const changedStatus = originalStatus === 'active' ? 'inactive' : 'active';
    await setUserStatusThroughUi(page, changedStatus);
    await setUserStatusThroughUi(page, originalStatus);

    expect(await snapshotNonTargetUserStatuses()).toEqual(otherUsersBefore);
  } finally {
    if (originalStatus) {
      try {
        if (!/\/admin\/users$/.test(page.url())) {
          await page.goto('/admin/users');
        }
        await setUserStatusThroughUi(page, originalStatus);
      } finally {
        const logoutButton = page.locator('#main-nav form[action="/logout"] button[type="submit"]');
        if (await logoutButton.count()) {
          await Promise.all([page.waitForURL(/\/login$/), logoutButton.click()]);
        }
      }
    }
  }
});

test('Admin can edit and restore only the dedicated test pharmacy through the UI', async ({ page }) => {
  let originalValues;
  let seededPharmaciesBefore;

  try {
    await loginAsTestAdmin(page);
    await page.goto('/admin/pharmacies');
    await expect(page.locator('h1')).toHaveText('Manage Pharmacies');

    const editForm = await openTestPharmacyEditForm(page);
    originalValues = await getEditablePharmacyValues(editForm);
    seededPharmaciesBefore = await snapshotSeededPharmacies();

    const changedPhone = originalValues.phone === '+1-555-0188'
      ? '+1-555-0187'
      : '+1-555-0188';
    await saveTestPharmacyPhone(page, changedPhone);

    const restoredForm = await openTestPharmacyEditForm(page);
    await expect(restoredForm.locator('#phone')).toHaveValue(changedPhone);
    await saveTestPharmacyPhone(page, originalValues.phone);

    const changedStatus = originalValues.status === 'active' ? 'inactive' : 'active';
    await setTestPharmacyStatusThroughUi(page, changedStatus);
    await setTestPharmacyStatusThroughUi(page, originalValues.status);

    const finalForm = await openTestPharmacyEditForm(page);
    expect(await getEditablePharmacyValues(finalForm)).toEqual(originalValues);
    expect(await snapshotSeededPharmacies()).toEqual(seededPharmaciesBefore);
  } finally {
    if (originalValues) {
      try {
        const currentForm = await openTestPharmacyEditForm(page);
        const currentValues = await getEditablePharmacyValues(currentForm);
        if (currentValues.phone !== originalValues.phone) {
          await saveTestPharmacyPhone(page, originalValues.phone);
        }
        if (currentValues.status !== originalValues.status) {
          await setTestPharmacyStatusThroughUi(page, originalValues.status);
        }
      } finally {
        const logoutButton = page.locator('#main-nav form[action="/logout"] button[type="submit"]');
        if (await logoutButton.count()) {
          await Promise.all([page.waitForURL(/\/login$/), logoutButton.click()]);
        }
      }
    }
  }
});

test('Admin can create, edit, toggle status, and manage dedicated test medicine through the UI', async ({ page }) => {
  let seededMedicinesBefore;

  try {
    await cleanupTestMedicines();
    seededMedicinesBefore = await snapshotSeededMedicines();

    await loginAsTestAdmin(page);
    await page.goto('/admin/medicines');
    await expect(page.locator('h1')).toHaveText('Manage Medicines');

    // 1. Create the dedicated test medicine
    await page.locator('a[href="/admin/medicines/add"]').click();
    await expect(page.locator('h1')).toHaveText('Add Medicine');

    const addForm = page.locator('form.auth-form');
    await addForm.locator('#name').fill('Playwright Test Medicine');
    await addForm.locator('#generic_name').fill('Test Generic');
    await addForm.locator('#category_id').selectOption({ index: 1 });
    await addForm.locator('#dosage_form').fill('Tablet');
    await addForm.locator('#strength').fill('100mg');
    await addForm.locator('#description').fill('Test medicine description for Playwright test.');
    await addForm.locator('#prescription_required').check();
    await addForm.locator('#status').selectOption('active');

    await Promise.all([
      page.waitForURL(/\/admin\/medicines$/),
      addForm.locator('button[type="submit"]').click(),
    ]);
    await expect(page.locator('.alert-success')).toContainText(
      'Medicine "Playwright Test Medicine" was added successfully.',
    );

    // 2. Verify it appears in the medicine list
    const createdRow = page.locator('table tbody tr').filter({
      hasText: 'Playwright Test Medicine',
    });
    await expect(createdRow).toHaveCount(1);
    await expect(createdRow.locator('td').nth(1)).toHaveText('Test Generic');
    await expect(createdRow.locator('td').nth(3)).toHaveText('100mg');
    await expect(createdRow.locator('.badge-success')).toHaveText('Active');

    // 3. Open its edit page through the actual UI
    const editLink = createdRow.locator('a[href^="/admin/medicines/"][href$="/edit"]');
    await expect(editLink).toHaveCount(1);
    await editLink.click();
    await expect(page.locator('h1')).toHaveText('Edit Medicine');

    // 4. Change a safe field
    const editForm = page.locator('form.auth-form');
    await expect(editForm.locator('#name')).toHaveValue('Playwright Test Medicine');
    await expect(editForm.locator('#strength')).toHaveValue('100mg');
    await editForm.locator('#strength').fill('200mg');

    // 5. Save and verify the change
    await Promise.all([
      page.waitForURL(/\/admin\/medicines$/),
      editForm.locator('button[type="submit"]').click(),
    ]);
    await expect(page.locator('.alert-success')).toContainText(
      'Medicine "Playwright Test Medicine" was updated successfully.',
    );
    const updatedRow = page.locator('table tbody tr').filter({
      hasText: 'Playwright Test Medicine',
    });
    await expect(updatedRow.locator('td').nth(3)).toHaveText('200mg');

    // 6. Test activate/deactivate and restore original state
    const deactivateForm = updatedRow.locator('form[action$="/deactivate"]');
    await expect(deactivateForm).toHaveCount(1);
    await Promise.all([
      page.waitForURL(/\/admin\/medicines$/),
      deactivateForm.locator('button[type="submit"]').click(),
    ]);
    await expect(page.locator('.alert-success')).toContainText(
      'Medicine "Playwright Test Medicine" was deactivated.',
    );

    const deactivatedRow = page.locator('table tbody tr').filter({
      hasText: 'Playwright Test Medicine',
    });
    await expect(deactivatedRow.locator('.badge-danger')).toHaveText('Inactive');

    const activateForm = deactivatedRow.locator('form[action$="/activate"]');
    await expect(activateForm).toHaveCount(1);
    await Promise.all([
      page.waitForURL(/\/admin\/medicines$/),
      activateForm.locator('button[type="submit"]').click(),
    ]);
    await expect(page.locator('.alert-success')).toContainText(
      'Medicine "Playwright Test Medicine" was activated.',
    );

    const reactivatedRow = page.locator('table tbody tr').filter({
      hasText: 'Playwright Test Medicine',
    });
    await expect(reactivatedRow.locator('.badge-success')).toHaveText('Active');

    // Note: Medicine hard deletion is not supported in the UI (soft deactivation only).
    // Cleanup is handled in finally block to ensure DB hygiene.

    // 7. Verify no seeded medicine was modified
    const seededMedicinesAfter = await snapshotSeededMedicines();
    expect(seededMedicinesAfter).toEqual(seededMedicinesBefore);
  } finally {
    try {
      await cleanupTestMedicines();
    } finally {
      const logoutButton = page.locator('#main-nav form[action="/logout"] button[type="submit"]');
      if (await logoutButton.count()) {
        await Promise.all([page.waitForURL(/\/login$/), logoutButton.click()]);
      }
    }
  }
});

test('Admin can create, edit, and manage dedicated test category through the UI', async ({ page }) => {
  let seededCategoriesBefore;

  try {
    await cleanupTestCategories();
    seededCategoriesBefore = await snapshotSeededCategories();

    await loginAsTestAdmin(page);
    await page.goto('/admin/categories');
    await expect(page.locator('h1')).toHaveText('Manage Categories');

    // 1. Create the dedicated test category through the UI
    const addCard = page.locator('.admin-card').filter({
      has: page.locator('h2', { hasText: 'Add Category' }),
    });
    await expect(addCard).toHaveCount(1);

    const addForm = addCard.locator('form');
    await addForm.locator('#name').fill('Playwright Test Category');
    await addForm.locator('#description').fill('Test category description');

    await Promise.all([
      page.waitForURL(/\/admin\/categories$/),
      addForm.locator('button[type="submit"]').click(),
    ]);
    await expect(page.locator('.alert-success')).toContainText(
      'Category "Playwright Test Category" was added successfully.',
    );

    // 2. Verify it appears in the list
    const categoryRow = page.locator('table tbody tr').filter({
      hasText: 'Playwright Test Category',
    });
    await expect(categoryRow).toHaveCount(1);
    await expect(categoryRow.locator('.table-sub')).toHaveText('Test category description');

    // 3. Open its edit form through the actual UI
    const editLink = categoryRow.locator('a[href^="/admin/categories/"][href$="/edit"]');
    await expect(editLink).toHaveCount(1);
    await editLink.click();
    await expect(page.locator('h1')).toHaveText('Edit Category');

    // 4. Change description/name using the real form
    const editForm = page.locator('form.auth-form');
    await expect(editForm.locator('#name')).toHaveValue('Playwright Test Category');
    await expect(editForm.locator('#description')).toHaveValue('Test category description');
    await editForm.locator('#description').fill('Updated test category description');

    // 5. Save and verify the change
    await Promise.all([
      page.waitForURL(/\/admin\/categories$/),
      editForm.locator('button[type="submit"]').click(),
    ]);
    await expect(page.locator('.alert-success')).toContainText(
      'Category "Playwright Test Category" was updated successfully.',
    );

    const updatedRow = page.locator('table tbody tr').filter({
      hasText: 'Playwright Test Category',
    });
    await expect(updatedRow.locator('.table-sub')).toHaveText('Updated test category description');

    // 6. Activate/deactivate is not implemented for categories in the application UI
    await expect(updatedRow.locator('form[action$="/activate"], form[action$="/deactivate"]')).toHaveCount(0);

    // 7. Verify existing seeded categories were not modified
    const seededCategoriesAfter = await snapshotSeededCategories();
    expect(seededCategoriesAfter).toEqual(seededCategoriesBefore);
  } finally {
    try {
      await cleanupTestCategories();
    } finally {
      const logoutButton = page.locator('#main-nav form[action="/logout"] button[type="submit"]');
      if (await logoutButton.count()) {
        await Promise.all([page.waitForURL(/\/login$/), logoutButton.click()]);
      }
    }
  }
});
