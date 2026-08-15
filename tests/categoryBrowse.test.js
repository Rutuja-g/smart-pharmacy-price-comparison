const { test, expect } = require('@playwright/test');

test('Category browsing shows categories and their medicines', async ({ page }) => {
  await page.goto('/categories');

  await expect(page.locator('h1')).toHaveText('Browse Categories');

  const categoryCards = page.locator('.category-card');
  const categoryCount = await categoryCards.count();
  expect(categoryCount).toBeGreaterThan(0);

  const firstCategoryHref = await categoryCards.nth(0).getAttribute('href');
  expect(firstCategoryHref).toMatch(/^\/categories\/\d+$/);

  const firstCategoryName = await categoryCards.nth(0).locator('h3').textContent();
  await categoryCards.nth(0).click();

  await expect(page).toHaveURL(new RegExp(`^http://localhost:3000${firstCategoryHref}$`));

  await expect(page.locator('h1')).toHaveText(firstCategoryName.trim());

  const medicineCards = page.locator('.result-card');
  const medicineCount = await medicineCards.count();
  expect(medicineCount).toBeGreaterThan(0);

  for (let i = 0; i < medicineCount; i++) {
    const link = medicineCards.nth(i);
    await expect(link).toHaveAttribute('href', /^\/medicines\/\d+$/);
  }
});
