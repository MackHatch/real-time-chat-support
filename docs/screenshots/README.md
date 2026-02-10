# Screenshots

This directory contains screenshots for the project documentation.

## Required Screenshots

To capture screenshots for the portfolio:

1. **inbox.png** - Agent inbox view showing conversations list with unassigned/needs attention indicators
2. **conversation.png** - Active conversation view with message thread and agent tools
3. **widget.png** - Customer-facing widget interface
4. **analytics.png** - Analytics dashboard with KPIs and charts

## How to Capture

1. Start the application in development mode:
   ```bash
   npm run dev
   ```

2. Log in as an agent using the demo credentials:
   - Email: `agent@local.test`
   - Password: `Agent123!`

3. Navigate to each section and capture screenshots:
   - Inbox: `http://localhost:5173/app/inbox`
   - Conversation: Click any conversation from the inbox
   - Widget: `http://localhost:5173/widget`
   - Analytics: `http://localhost:5173/app/analytics`

4. Save screenshots as PNG files in this directory with the names listed above.

## Tips

- Use browser DevTools to hide the demo tour panel if needed
- Capture at 1920x1080 or similar resolution for best quality
- Ensure the UI is fully loaded before capturing
- Consider using browser extensions for full-page screenshots
