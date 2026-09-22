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
    await agentPage.addInitScript(() => {
      window.localStorage.setItem('showDemoTour', 'false');
    });

    // Step 1: Agent login
    await agentPage.goto('/login');
    await agentPage.getByTestId('login-email').fill('agent@local.test');
    await agentPage.getByTestId('login-password').fill('Agent123!');
    await agentPage.getByTestId('login-submit').click();
    await expect(agentPage).toHaveURL(/\/app\/inbox/);

    // Step 2: Customer widget session — capture conversationId so the agent
    // opens the exact thread (avoids inbox filter races with seeded demos).
    const sessionResponsePromise = widgetPage.waitForResponse(
      (res) =>
        res.url().includes('/widget/session') &&
        res.request().method() === 'POST' &&
        res.ok(),
    );
    await widgetPage.goto('/widget');
    const sessionResponse = await sessionResponsePromise;
    const session = (await sessionResponse.json()) as { conversationId: string };
    expect(session.conversationId).toBeTruthy();

    await expect(widgetPage.getByTestId('widget-message-input')).toBeEnabled({
      timeout: 15_000,
    });
    await widgetPage.getByTestId('widget-message-input').fill(uniqueMessage);
    await widgetPage.getByTestId('widget-send').click();
    await expect(
      widgetPage.getByTestId('widget-message-list').getByText(uniqueMessage),
    ).toBeVisible({ timeout: 15_000 });

    // Step 3: Agent opens that conversation directly
    await agentPage.goto(`/app/conversations/${session.conversationId}`);
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
