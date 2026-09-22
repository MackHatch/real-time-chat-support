import { test, expect } from '@playwright/test';

test('customer ↔ agent realtime messaging', async ({ browser }) => {
  const uniqueMessage = `hello-${Date.now()}`;
  const uniqueReply = `reply-${Date.now()}`;

  // Create two browser contexts for agent and customer
  const agentContext = await browser.newContext();
  const widgetContext = await browser.newContext();

  const agentPage = await agentContext.newPage();
  const widgetPage = await widgetContext.newPage();

  try {
    // Step 1: Agent login
    await agentPage.goto('/login');
    await agentPage.getByTestId('login-email').fill('agent@local.test');
    await agentPage.getByTestId('login-password').fill('Agent123!');
    await agentPage.getByTestId('login-submit').click();
    await expect(agentPage).toHaveURL(/\/app\/inbox/);

    // Widget conversations are unassigned; default inbox filter is "Assigned to me"
    // (seed also includes an assigned demo convo), so switch before waiting for the new row.
    await agentPage.getByTestId('inbox-toggle-unassigned').click();
    await expect(agentPage.getByTestId('convo-list')).toBeVisible({ timeout: 10000 });

    const priorFirstConvoId = await agentPage
      .getByTestId(/^convo-item-/)
      .first()
      .getAttribute('data-testid')
      .catch(() => null);

    // Step 2: Customer sends message in widget
    await widgetPage.goto('/widget');
    await widgetPage.getByTestId('widget-message-input').waitFor({ state: 'visible' });

    // Wait for widget to be ready (session loaded)
    await expect(widgetPage.getByTestId('widget-message-input')).toBeEnabled();

    await widgetPage.getByTestId('widget-message-input').fill(uniqueMessage);
    await widgetPage.getByTestId('widget-send').click();

    // Verify message appears in widget
    await expect(
      widgetPage.getByTestId('widget-message-list').getByText(uniqueMessage)
    ).toBeVisible({ timeout: 10000 });

    // Step 3: Agent sees the new unassigned conversation (sorted by lastMessageAt).
    // Poll with a forced filter toggle so we don't depend solely on socket invalidation
    // (750ms debounce) and don't open a stale seeded unassigned row.
    const firstConversation = agentPage.getByTestId(/^convo-item-/).first();
    await expect
      .poll(
        async () => {
          await agentPage.getByTestId('inbox-toggle-all').click();
          await agentPage.getByTestId('inbox-toggle-unassigned').click();
          await expect(agentPage.getByTestId('convo-list')).toBeVisible();

          const id = await firstConversation
            .getAttribute('data-testid')
            .catch(() => null);
          if (!id) return null;
          if (priorFirstConvoId && id === priorFirstConvoId) return null;
          return id;
        },
        { timeout: 15000 },
      )
      .not.toBeNull();

    await firstConversation.click();

    // Wait for conversation page to load
    await expect(agentPage.getByTestId('message-list')).toBeVisible({ timeout: 10000 });

    // Verify customer message appears in agent view (REST load + socket)
    await expect(
      agentPage.getByTestId('message-list').getByText(uniqueMessage)
    ).toBeVisible({ timeout: 15000 });

    // Step 4: Agent replies
    await agentPage.getByTestId('message-input').fill(uniqueReply);
    await agentPage.getByTestId('message-send').click();

    // Verify agent message appears in agent view
    await expect(
      agentPage.getByTestId('message-list').getByText(uniqueReply)
    ).toBeVisible({ timeout: 10000 });

    // Step 5: Widget receives reply
    await expect(
      widgetPage.getByTestId('widget-message-list').getByText(uniqueReply)
    ).toBeVisible({ timeout: 10000 });
  } finally {
    await agentContext.close();
    await widgetContext.close();
  }
});
