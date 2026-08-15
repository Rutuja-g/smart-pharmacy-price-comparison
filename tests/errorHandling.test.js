const { test, expect } = require('@playwright/test');

test.describe('Error handling and invalid route tests', () => {
  test('1. Malformed medicine ID (/medicines/abc) returns 404 error page', async ({ page }) => {
    const response = await page.goto('/medicines/abc');
    expect(response.status()).toBe(404);
    await expect(page.locator('h1')).toHaveText('Medicine Not Found');
    await expect(page.locator('section.error p')).toHaveText(
      'The medicine you are looking for does not exist.'
    );
  });

  test('2. Non-existent numeric medicine ID (/medicines/999999) returns 404 error page', async ({ page }) => {
    const response = await page.goto('/medicines/999999');
    expect(response.status()).toBe(404);
    await expect(page.locator('h1')).toHaveText('Medicine Not Found');
    await expect(page.locator('section.error p')).toHaveText(
      'The medicine you are looking for does not exist.'
    );
  });

  test('3. Malformed category ID (/categories/abc) returns 404 error page', async ({ page }) => {
    const response = await page.goto('/categories/abc');
    expect(response.status()).toBe(404);
    await expect(page.locator('h1')).toHaveText('Category Not Found');
    await expect(page.locator('section.error p')).toHaveText(
      'The category you are looking for does not exist.'
    );
  });

  test('4. Non-existent category ID (/categories/999999) returns 404 error page', async ({ page }) => {
    const response = await page.goto('/categories/999999');
    expect(response.status()).toBe(404);
    await expect(page.locator('h1')).toHaveText('Category Not Found');
    await expect(page.locator('section.error p')).toHaveText(
      'The category you are looking for does not exist.'
    );
  });

  test('5. Completely non-existent path (/does-not-exist) returns 404 error page', async ({ page }) => {
    const response = await page.goto('/does-not-exist');
    expect(response.status()).toBe(404);
    await expect(page.locator('h1')).toHaveText('Page Not Found');
    await expect(page.locator('section.error p')).toHaveText(
      'The page you are looking for does not exist.'
    );
  });

  test('6. Unauthenticated access to protected route (/admin/dashboard) redirects to /login', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('h1')).toHaveText('Welcome back');
  });
});
