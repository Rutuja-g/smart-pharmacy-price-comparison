const { test, expect } = require('@playwright/test');

test('Authenticated wishlist flow', async ({ page, context }) => {
  const testEmail = 'test-user@playwright.local';
  const testPassword = process.env.PLAYWRIGHT_TEST_PASSWORD_USER;

  if (!testPassword) {
    throw new Error('PLAYWRIGHT_TEST_PASSWORD_USER environment variable is not set');
  }

  let medicinePath;
  let medicineName;
  let wishlistRecordCreated = false;
  let duplicateAddPage;

  try {
    // 1. Login through the rendered login form.
    await page.goto('/login');
    await page.locator('#email').fill(testEmail);
    await page.locator('#password').fill(testPassword);
    await Promise.all([
      page.waitForURL(/\/profile$/),
      page.locator('form[action="/login"] button[type="submit"]').click(),
    ]);

    // 2. Open the wishlist and retain any pre-existing items. The test only
    // cleans up the particular item that it creates.
    await page.goto('/wishlist');
    await expect(page.locator('h1')).toHaveText('My Wishlist');
    const existingWishlistPaths = await page
      .locator('table tbody tr td:first-child a[href^="/medicines/"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));

    // 3. Choose an active medicine from the rendered catalogue that is not
    // already in this user's wishlist.
    await page.goto('/medicines');
    const medicineLinks = page.locator('table tbody tr a[href^="/medicines/"]');
    const medicineCount = await medicineLinks.count();
    let medicineLink;
    for (let index = 0; index < medicineCount; index += 1) {
      const candidate = medicineLinks.nth(index);
      const candidatePath = await candidate.getAttribute('href');
      if (candidatePath && !existingWishlistPaths.includes(candidatePath)) {
        medicineLink = candidate;
        medicinePath = candidatePath;
        break;
      }
    }
    expect(medicinePath, 'an active medicine not already in the wishlist').toBeTruthy();

    await medicineLink.click();
    await expect(page).toHaveURL(new RegExp(`${medicinePath}$`));
    medicineName = (await page.locator('h1').textContent()).trim();

    const addButton = page.locator('.wishlist-actions form button[type="submit"]');
    await expect(addButton).toHaveText('Add to Wishlist');

    // Keep a second, real detail-page form open before adding. Submitting it
    // after the first add exercises the server's duplicate handling without
    // injecting a synthetic form or bypassing CSRF protection.
    duplicateAddPage = await context.newPage();
    await duplicateAddPage.goto(medicinePath);
    const duplicateAddButton = duplicateAddPage.locator(
      '.wishlist-actions form button[type="submit"]',
    );
    await expect(duplicateAddButton).toHaveText('Add to Wishlist');

    // 4. Add it to the wishlist.
    await Promise.all([
      page.waitForURL(new RegExp(`${medicinePath}$`)),
      addButton.click(),
    ]);
    wishlistRecordCreated = true;
    await expect(page.locator('.alert-success')).toContainText(
      `"${medicineName}" was added to your wishlist.`,
    );

    // 5. Verify the selected medicine appears exactly once.
    await page.goto('/wishlist');
    const wishlistRow = page
      .locator('table tbody tr')
      .filter({ has: page.locator(`a[href="${medicinePath}"]`) });
    await expect(wishlistRow).toHaveCount(1);
    await expect(wishlistRow.locator('td:first-child a')).toHaveText(medicineName);

    // 6. Submit the stale but rendered add form and verify duplicate handling.
    await Promise.all([
      duplicateAddPage.waitForURL(new RegExp(`${medicinePath}$`)),
      duplicateAddButton.click(),
    ]);
    await expect(duplicateAddPage.locator('.alert-info')).toContainText(
      `"${medicineName}" is already in your wishlist.`,
    );
    await page.goto('/wishlist');
    await expect(wishlistRow).toHaveCount(1);

    // 7. Remove it with the button rendered in its wishlist row.
    await Promise.all([
      page.waitForURL(/\/wishlist$/),
      wishlistRow.locator('form button[type="submit"]').click(),
    ]);
    wishlistRecordCreated = false;

    // 8. Verify that only the medicine created by this test disappeared.
    await expect(page.locator('.alert-success')).toContainText(
      'Medicine removed from your wishlist.',
    );
    await expect(wishlistRow).toHaveCount(0);
  } finally {
    // Clean up only the record created by this test, including after a failed
    // assertion part-way through the flow.
    if (wishlistRecordCreated && medicinePath) {
      await page.goto('/wishlist');
      const createdRow = page
        .locator('table tbody tr')
        .filter({ has: page.locator(`a[href="${medicinePath}"]`) });
      if (await createdRow.count()) {
        await Promise.all([
          page.waitForURL(/\/wishlist$/),
          createdRow.locator('form button[type="submit"]').click(),
        ]);
      }
    }

    if (duplicateAddPage) {
      await duplicateAddPage.close();
    }

    // 9. Logout through the application form.
    const logoutButton = page.locator('#main-nav form[action="/logout"] button[type="submit"]');
    if (await logoutButton.count()) {
      await Promise.all([page.waitForURL(/\/login$/), logoutButton.click()]);
    }
  }
});
