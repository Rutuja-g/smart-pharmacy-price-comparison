const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Prescription Upload, OCR & Price Comparison Flow', () => {
  test('1. Direct access to /prescription/review or /prescription/compare without session redirects to upload page', async ({ page }) => {
    // Attempting direct access to /prescription/review without prior session state
    await page.goto('/prescription/review');
    await expect(page).toHaveURL(/\/prescription\/upload$/);
    await expect(page.locator('.alert-error')).toContainText(
      'Please upload a prescription image first.'
    );

    // Attempting direct access to /prescription/compare without prior session state
    await page.goto('/prescription/compare');
    await expect(page).toHaveURL(/\/prescription\/upload$/);
    await expect(page.locator('.alert-error')).toContainText(
      'No confirmed prescription medicines found to compare.'
    );
  });

  test('2. Uploading an invalid non-image file type displays a user-friendly validation error', async ({ page }) => {
    await page.goto('/prescription/upload');

    // Create a temporary text file buffer
    const invalidFile = {
      name: 'invalid-document.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('This is a text document, not an image.'),
    };

    await page.setInputFiles('#prescriptionImage', invalidFile);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/prescription\/upload$/);
    await expect(page.locator('.alert-error')).toContainText(
      'Invalid file type. Please upload a JPEG, PNG, or WebP image.'
    );
  });

  test('3. Complete E2E Prescription flow: Upload synthetic image -> OCR -> Review DB matches -> Confirm -> View Price Comparison', async ({ page }) => {
    // 1. Visit upload page and verify UI elements & CSRF protection
    await page.goto('/prescription/upload');
    await expect(page.locator('h1')).toHaveText('Upload Prescription');

    const form = page.locator('form.upload-form');
    await expect(form).toBeVisible();

    const actionAttr = await form.getAttribute('action');
    expect(actionAttr).toContain('/prescription/process?_csrf=');

    // 2. Attach synthetic prescription image fixture containing seeded medicine 'Advil'
    const fixturePath = path.join(__dirname, 'fixtures', 'sample-prescription.png');
    await page.setInputFiles('#prescriptionImage', fixturePath);

    // 3. Submit upload and scan form
    await page.click('button[type="submit"]');

    // 4. Verify transition to Review page and candidate search results
    await expect(page).toHaveURL(/\/prescription\/review$/);
    await expect(page.locator('h1')).toHaveText('Review Detected Medicines');

    // Verify candidate matches are present
    const selects = page.locator('select[name="medicine_ids"]');
    const selectCount = await selects.count();
    expect(selectCount).toBeGreaterThan(0);

    // Select the first valid medicine option (Advil - ID 1) in the select box
    await selects.first().selectOption('1');

    // 5. Submit confirmation form
    await page.click('button[type="submit"]');

    // 6. Verify transition to Compare page and consolidated comparison UI
    await expect(page).toHaveURL(/\/prescription\/compare$/);
    await expect(page.locator('h1')).toHaveText('Prescription Price Comparison');

    // Verify user-confirmed notice alert
    await expect(page.locator('.alert-info')).toContainText('User-Confirmed Selection:');

    // Verify confirmed medicine card and pharmacy price comparison table are rendered
    await expect(page.locator('h2').first()).toContainText('Advil');
    await expect(page.locator('.compare-table')).toBeVisible();

    // Verify pharmacy price row entries are displayed
    const pharmacyRows = page.locator('.compare-table tbody tr');
    const rowCount = await pharmacyRows.count();
    expect(rowCount).toBeGreaterThan(0);
  });
});
