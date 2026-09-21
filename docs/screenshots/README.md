# Screenshots

This directory holds portfolio screenshots referenced by the root `README.md`.

**Do not** add markdown image embeds in the README until the PNG files below actually exist in this directory. Missing files show as broken placeholders on GitHub.

## Required Screenshots

| File | What to show |
|------|----------------|
| `inbox.png` | Agent inbox with conversation list (unassigned / needs-attention indicators) |
| `conversation.png` | Active conversation with message thread and agent tools |
| `widget.png` | Customer-facing widget interface |
| `analytics.png` | Analytics dashboard with KPIs and charts |

## How to Capture

1. Start the application in development mode:
   ```bash
   docker-compose up -d
   npm install
   # Set BACKEND_DATABASE_URL in backend/.env first (see root README)
   cd backend && npx prisma migrate deploy && npx prisma db seed && cd ..
   npm run dev
   ```

2. Log in as an agent:
   - Email: `agent@local.test`
   - Password: `Agent123!`

3. Navigate and capture each view:
   - Inbox: `http://localhost:5173/app/inbox`
   - Conversation: open any conversation from the inbox
   - Widget: `http://localhost:5173/widget`
   - Analytics: `http://localhost:5173/app/analytics`

4. Save the PNGs in this directory using the filenames above.

5. Re-add the image embeds to the root `README.md` Screenshots section (and optionally a hero image near the top).

## Tips

- Use browser DevTools to hide the demo tour panel if needed (`localStorage.setItem('showDemoTour', 'false')` then refresh)
- Capture at ~1920×1080 for README clarity
- Wait until lists, charts, and messages are fully loaded
- Prefer real seeded demo data over empty states
