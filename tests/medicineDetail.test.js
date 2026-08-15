const { test, expect } = require('@playwright/test');

test('Medicine detail page shows information and price comparison', async ({ page }) => {
  await page.goto('/');

  await page.fill('#medicine-search', 'Advil');
  await page.click('button[type="submit"]');

  await page.locator('.result-card').nth(0).click();

  await expect(page).toHaveURL(/^http:\/\/localhost:3000\/medicines\/\d+$/);

  await expect(page.locator('h1')).toHaveText('Advil');

  await expect(
    page.locator('.detail-item:has(.detail-label:has-text("Generic Name")) .detail-value')
  ).toHaveText('Ibuprofen');

  await expect(page.locator('.compare-section#compare')).toBeVisible();
  await expect(page.locator('#compare .compare-table')).toBeVisible();
  await expect(page.locator('.cheapest-banner')).toBeVisible();

  const cheapestPrice = page.locator('.cheapest-price');
  await expect(cheapestPrice).toContainText('₹');

  await expect(page.locator('.compare-section:has-text("Generic Alternatives")')).toBeVisible();
  await expect(page.locator('.alt-title')).toHaveCount(2);
});
