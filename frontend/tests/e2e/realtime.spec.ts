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

    // Step 3: Agent sees message in inbox/conversation
    // Wait for conversation to appear in inbox
    await expect(agentPage.getByTestId('convo-list')).toBeVisible({ timeout: 10000 });
    
    // Click first conversation item
    const firstConversation = agentPage.getByTestId(/^convo-item-/).first();
    await firstConversation.waitFor({ state: 'visible' });
    await firstConversation.click();

    // Wait for conversation page to load
    await expect(agentPage.getByTestId('message-list')).toBeVisible({ timeout: 10000 });

    // Verify customer message appears in agent view
    await expect(
      agentPage.getByTestId('message-list').getByText(uniqueMessage)
    ).toBeVisible({ timeout: 10000 });

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
