import { test, expect } from '@playwright/test';

test('agent can claim an unassigned conversation from the inbox', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByTestId('login-email').fill('agent@local.test');
  await page.getByTestId('login-password').fill('Agent123!');
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/app\/inbox/);

  await page.getByTestId('inbox-toggle-unassigned').click();
  await expect(page.getByTestId('convo-list')).toBeVisible({ timeout: 10000 });

  const claimButton = page.getByTestId(/^convo-claim-/).first();
  await claimButton.waitFor({ state: 'visible', timeout: 10000 });
  await claimButton.click();

  // After claim, conversation should leave the unassigned filter or claim control disappears
  await expect(claimButton).toBeHidden({ timeout: 10000 });
});
