const { test, expect } = require('@playwright/test');

test('Search for a medicine and verify results', async ({ page }) => {
  await page.goto('/');

  await page.fill('#medicine-search', 'Advil');
  await page.click('button[type="submit"]');

  await expect(page.locator('.result-card')).toBeVisible();

  const medicineLinks = page.locator('.result-card');
  const count = await medicineLinks.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const link = medicineLinks.nth(i);
    await expect(link).toHaveAttribute('href', /^\/medicines\/\d+$/);
  }
});
