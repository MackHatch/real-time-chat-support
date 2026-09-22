import { test, expect } from '@playwright/test';

test('customer ↔ agent realtime messaging', async ({ browser }) => {
  test.setTimeout(90_000);

  const uniqueMessage = `hello-${Date.now()}`;
  const uniqueReply = `reply-${Date.now()}`;

  const agentContext = await browser.newContext();
  const widgetContext = await browser.newContext();

  const agentPage = await agentContext.newPage();
  const widgetPage = await widgetContext.newPage();

  try {
    // Dismiss demo tour if present so it doesn't intercept clicks
    await agentPage.addInitScript(() => {
      window.localStorage.setItem('showDemoTour', 'false');
    });

    // Step 1: Agent login
    await agentPage.goto('/login');
    await agentPage.getByTestId('login-email').fill('agent@local.test');
    await agentPage.getByTestId('login-password').fill('Agent123!');
    await agentPage.getByTestId('login-submit').click();
    await expect(agentPage).toHaveURL(/\/app\/inbox/);

    // Step 2: Customer starts a widget session and sends a unique message
    await widgetPage.goto('/widget');
    await expect(widgetPage.getByTestId('widget-message-input')).toBeEnabled({
      timeout: 15_000,
    });
    await widgetPage.getByTestId('widget-message-input').fill(uniqueMessage);
    await widgetPage.getByTestId('widget-send').click();
    await expect(
      widgetPage.getByTestId('widget-message-list').getByText(uniqueMessage),
    ).toBeVisible({ timeout: 15_000 });

    // Step 3: Open the newest unassigned conversation via a fresh REST load.
    // Default filter is "Assigned to me" (seed demo); widget chats are unassigned.
    // Avoid socket-debounce races by navigating with the filter in the URL.
    await agentPage.goto('/app/inbox?assigned=unassigned');
    await expect(agentPage.getByTestId('convo-list')).toBeVisible({
      timeout: 15_000,
    });

    const firstConversation = agentPage.getByTestId(/^convo-item-/).first();
    await expect(firstConversation).toBeVisible({ timeout: 15_000 });
    await firstConversation.click();

    await expect(agentPage.getByTestId('message-list')).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      agentPage.getByTestId('message-list').getByText(uniqueMessage),
    ).toBeVisible({ timeout: 15_000 });

    // Step 4: Agent replies over the socket
    await agentPage.getByTestId('message-input').fill(uniqueReply);
    await agentPage.getByTestId('message-send').click();
    await expect(
      agentPage.getByTestId('message-list').getByText(uniqueReply),
    ).toBeVisible({ timeout: 15_000 });

    // Step 5: Widget receives the reply in realtime
    await expect(
      widgetPage.getByTestId('widget-message-list').getByText(uniqueReply),
    ).toBeVisible({ timeout: 15_000 });
  } finally {
    await agentContext.close().catch(() => undefined);
    await widgetContext.close().catch(() => undefined);
  }
});
