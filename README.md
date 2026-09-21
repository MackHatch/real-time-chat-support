# Real-time Chat Support Application

A full-stack, production-oriented customer support chat application (Intercom-lite) built with modern technologies. This monorepo includes a NestJS backend with Socket.IO real-time communication and a React frontend with an embeddable customer widget.

## What This Is

This is a **customer support chat platform** similar to Intercom or Zendesk Chat, featuring:

- **Real-time messaging** between agents and customers via WebSockets
- **Multi-agent routing** with conversation assignment and queue management
- **SLA-style attention indicators** for conversations needing agent response
- **Ticket management** linked to conversations with status tracking
- **Analytics dashboard** with KPIs, throughput metrics, and CSV export
- **Embeddable customer widget** that can be integrated into any website

## Features

### Technical Highlights

- **Backend**: NestJS (TypeScript), Prisma ORM, PostgreSQL, Redis, JWT auth, Socket.IO
- **Frontend**: React 19, Vite, TanStack Query, Tailwind CSS, React Router
- **Security**: Rate limiting, message sanitization, Helmet headers, audit logging
- **Scalability**: Redis adapter for Socket.IO horizontal scaling
- **Testing**: Jest unit/controller tests (claim races, auth, widget, rate limits) plus Playwright E2E with CI/CD
- **Deployment**: Docker containers with health checks and production configs

- **Needs-attention design**: SQL comparison of `lastAgentMessageAt` and `lastCustomerMessageAt` keeps filtered inbox pagination and totals correct. The unfiltered inbox prioritizes needs-attention rows within each page; global sorting would require a maintained `needsAttention` column or expression index.

## Quickstart

### Prerequisites

- **Node.js** >= 20
- **npm**
- **Docker** and **Docker Compose**

### One-Command Demo Setup

```bash
# 1. Start databases
docker-compose up -d

# 2. Install dependencies
npm install

# 3. Setup database and seed demo data
# Requires BACKEND_DATABASE_URL in backend/.env (see Environment Configuration)
cd backend
npx prisma migrate deploy
npx prisma db seed
cd ..

# 4. Start both apps
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **API Docs**: http://localhost:3000/api/docs

### Demo Credentials

Use these credentials to log in:

- **Admin**: `admin@local.test` / `Admin123!`
- **Agent**: `agent@local.test` / `Agent123!`

The seed script creates demo scenarios:
- Unassigned conversation (needs attention)
- Assigned active conversation
- Closed conversation
- Tickets in all statuses (NEW, OPEN, PENDING, RESOLVED)

## Project Structure

```
.
├── backend/          # NestJS backend
│   ├── src/
│   │   ├── auth/    # JWT authentication
│   │   ├── conversations/  # Conversation management
│   │   ├── tickets/        # Ticket system
│   │   ├── realtime/        # Socket.IO gateway
│   │   ├── widget/          # Customer widget API
│   │   ├── analytics/       # Analytics endpoints
│   │   ├── health/          # Health checks
│   │   └── ratelimit/       # Rate limiting
│   └── prisma/      # Database schema & migrations
├── frontend/        # React frontend
│   ├── src/
│   │   ├── pages/   # Route pages
│   │   ├── features/  # Feature modules
│   │   ├── components/  # Reusable components
│   │   └── lib/      # Utilities
│   └── public/      # Static assets
└── docs/            # Documentation & screenshots
```

## Environment Configuration

### Backend (`.env` in `backend/`)

Copy `backend/.env.example` to `backend/.env`, then adjust as needed:

```bash
BACKEND_PORT=3000
BACKEND_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/support_chat?schema=public
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=change_me
JWT_ACCESS_EXPIRES_IN=8h
APP_ORIGIN=http://localhost:5173
WIDGET_TOKEN_EXPIRES_IN=1h
```

`BACKEND_DATABASE_URL` is the single database connection string used by both Prisma CLI and the NestJS app.

### Frontend (`.env` in `frontend/`)

```bash
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
```

## Embedding the Widget

The customer chat widget can be embedded in any website with a single script tag:

```html
<script src="http://localhost:5173/widget.js"
        data-base-url="http://localhost:5173"></script>
```

For production, replace `localhost:5173` with your frontend domain.

The widget automatically:
- Creates or resumes customer sessions
- Connects via WebSocket for real-time messaging
- Handles page context (URL, referrer) for analytics

See `examples/vanilla/index.html` for a complete integration example.

## API Documentation

Interactive API documentation is available at:

**http://localhost:3000/api/docs**

The Swagger UI includes:
- All REST endpoints with request/response schemas
- Authentication requirements
- Try-it-out functionality

## Screenshots

### Real-time agent ↔ customer chat

| Agent view | Customer widget |
|------------|-----------------|
| ![Agent conversation](./docs/screenshots/agent-convo-realtime.png) | ![Customer conversation](./docs/screenshots/customer-convo-realtime.png) |

### Needs attention & tickets

| Needs-attention banner | Ticket list |
|------------------------|-------------|
| ![Needs attention](./docs/screenshots/ticket-needs-attention.png) | ![Ticket management](./docs/screenshots/ticket-mgmt.png) |

### Customer widget & analytics

| Embeddable widget | Analytics dashboard |
|-------------------|---------------------|
| ![Customer chat widget](./docs/screenshots/customer-chat-widget.png) | ![Analytics](./docs/screenshots/analytics.png) |

## Development

### Running Services

```bash
# Start databases
npm run db:up

# Start both apps
npm run dev

# Or individually
npm run dev:backend
npm run dev:frontend
```

### Database Management

```bash
cd backend

# Apply committed migrations (preferred for clean checkouts / CI)
npm run prisma:deploy

# Create a new migration during development
npm run prisma:migrate

# Seed demo data
npm run prisma:seed

# Open Prisma Studio
npm run prisma:studio
```

Prisma CLI and the Nest app both read `BACKEND_DATABASE_URL` (set it in `backend/.env`).

### Testing

```bash
# Backend unit tests (claim race, auth, widget session, rate limit, socket auth)
npm test --workspace backend

# Backend controller e2e (auth guard + claim wiring; no DB required)
npm run test:e2e --workspace backend

# Frontend Playwright E2E (requires backend + frontend + seeded DB)
npm run test:e2e --workspace frontend
```

Coverage includes concurrent conversation claiming, auth failures, unauthorized inbox access, widget session creation, and in-memory rate limiting.

## Production Deployment

Build and run the stack with the production Compose file (repo-root build context):

```bash
docker compose -f docker-compose.prod.yml up --build
```

- **Frontend**: http://localhost (nginx; proxies `/api` and `/socket.io` to the backend)
- **Backend API**: http://localhost:3000/api (also reachable directly)

The frontend image is built with same-origin `/api` URLs so the browser does not need to resolve the Docker service name `backend`. The backend container runs `prisma migrate deploy` on startup before listening.

Override secrets and origins via environment variables / an `.env` file before deploying (especially `JWT_ACCESS_SECRET` and `APP_ORIGIN`). The backend image entrypoint is `dist/main.entry.js` so OpenTelemetry initializes before NestJS when tracing is enabled.

Key production features:
- Multi-stage Docker builds
- Health check endpoints
- Non-root container users
- Environment-based configuration
- Redis-backed Socket.IO scaling
- OpenTelemetry-ready backend entrypoint

## Security Features

- **Rate Limiting**: Configurable limits on REST and Socket.IO endpoints
- **Message Sanitization**: All user input sanitized before storage
- **Security Headers**: Helmet middleware with safe defaults
- **Audit Logging**: Comprehensive event logging for compliance
- **CORS**: Strict origin validation
- **JWT Authentication**: Secure token-based auth for agents and customers

### Token storage

Agent access tokens are stored in `localStorage` for the current SPA implementation, making them accessible to JavaScript and therefore vulnerable to token theft if XSS occurs.

A production-hardened implementation would use **HttpOnly + Secure + SameSite cookies** or short-lived in-memory access tokens with refresh-token rotation, alongside a strict Content Security Policy.

Widget customer JWTs remain in memory for the page session; only the stable `widgetExternalId` is persisted for conversation continuity.

## Observability

The backend includes optional **OpenTelemetry tracing** and **Prometheus metrics** for production-style observability.

Instrumentation covers:

- **HTTP requests** and request latency
- **Prisma database operations**
- **Socket.IO events**, including connections, messaging, conversation claiming, and typing
- **WebSocket throughput and rejected messages**

The local Docker stack includes an **OpenTelemetry Collector** and **Jaeger** for trace inspection. Prometheus-compatible metrics are exposed at `/api/metrics` when enabled.

Observability is opt-in through environment configuration:

```bash
OTEL_ENABLED=true
OTEL_SERVICE_NAME=support-chat-backend
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
METRICS_ENABLED=true
```

## License

UNLICENSED — All rights reserved.
