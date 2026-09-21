import { test, expect } from '@playwright/test';

test('login rejects invalid credentials', async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('login-email').fill('agent@local.test');
  await page.getByTestId('login-password').fill('not-the-password');
  await page.getByTestId('login-submit').click();

  await expect(page.getByTestId('login-error')).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveURL(/\/login/);
});

test('unauthenticated users are redirected away from the inbox', async ({
  page,
}) => {
  await page.goto('/app/inbox');
  await expect(page).toHaveURL(/\/login/);
});
