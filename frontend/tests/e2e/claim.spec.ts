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
  // Pin this conversation — other unassigned rows (e.g. from realtime e2e)
  // must not make `.first()` rematch a different Claim button after click.
  const claimTestId = await claimButton.getAttribute('data-testid');
  expect(claimTestId).toBeTruthy();
  const pinnedClaim = page.getByTestId(claimTestId!);
  await pinnedClaim.click();

  await expect(pinnedClaim).toBeHidden({ timeout: 10000 });
});
