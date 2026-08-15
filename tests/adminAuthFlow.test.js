const { test, expect } = require('@playwright/test');

const adminRoutes = [
  '/admin',
  '/admin/dashboard',
  '/admin/users',
  '/admin/pharmacies',
  '/admin/medicines',
  '/admin/categories',
];

for (const route of adminRoutes) {
  test(`unauthenticated access to ${route} redirects to login`, async ({ page }) => {
    await page.goto(route);

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('.alert-error').nth(0)).toContainText(
      'You must be logged in to access that page.'
    );
  });
}
