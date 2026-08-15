const { test, expect } = require('@playwright/test');

test('Authentication flow - login page, invalid login, and protected redirects', async ({ page }) => {
  await page.goto('/login');

  await expect(page.locator('h1')).toHaveText('Welcome back');
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toHaveText('Login');

  await page.fill('#email', 'user@example.com');
  await page.fill('#password', 'WrongPassword123!');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('h1')).toHaveText('Welcome back');
  await expect(page.locator('.alert-error').nth(0)).toContainText(
    'Invalid email or password.'
  );

  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login$/);

  await page.goto('/wishlist');
  await expect(page).toHaveURL(/\/login$/);
});

test('Successful login with test user and authenticated navigation', async ({ page }) => {
  const testEmail = 'test-user@playwright.local';
  const testPassword = process.env.PLAYWRIGHT_TEST_PASSWORD_USER;

  if (!testPassword) {
    throw new Error('PLAYWRIGHT_TEST_PASSWORD_USER environment variable is not set');
  }

  await page.goto('/login');

  await expect(page.locator('h1')).toHaveText('Welcome back');
  await page.fill('#email', testEmail);
  await page.fill('#password', testPassword);
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.locator('.alert-success')).toContainText(
    `Welcome back, ${testEmail.split('@')[0]}!`
  );

  await expect(page.locator('a[href="/profile"]')).toHaveText('My Profile');
  await expect(page.locator('#main-nav form[action="/logout"] button')).toHaveText('Logout');

  await page.goto('/profile');
  await expect(page.locator('h1')).toHaveText(testEmail.split('@')[0]);

  await page.goto('/wishlist');
  await expect(page.locator('h1')).toHaveText('My Wishlist');

  await page.click('#main-nav form[action="/logout"] button');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('h1')).toHaveText('Welcome back');
  await expect(page.locator('#main-nav a[href="/login"]')).toHaveText('Login');
  await expect(page.locator('#main-nav a[href="/register"]')).toHaveText('Register');

  await page.goto('/profile');
  await expect(page).toHaveURL(/\/login$/);
});
