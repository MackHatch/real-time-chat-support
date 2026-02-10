# Real-time Chat Support Application

A full-stack, production-ready customer support chat application (Intercom-lite) built with modern technologies. This monorepo includes a NestJS backend with Socket.IO real-time communication and a React frontend with an embeddable customer widget.

![Inbox View](./docs/screenshots/inbox.png)
*Agent inbox with conversation management*

## What This Is

This is a **customer support chat platform** similar to Intercom or Zendesk Chat, featuring:

- **Real-time messaging** between agents and customers via WebSockets
- **Multi-agent routing** with conversation assignment and queue management
- **SLA-style attention indicators** for conversations needing agent response
- **Ticket management** linked to conversations with status tracking
- **Analytics dashboard** with KPIs, throughput metrics, and CSV export
- **Embeddable customer widget** that can be integrated into any website

Perfect for demonstrating full-stack development skills, real-time systems, and production-ready practices.

## Features

### Core Functionality

- ✅ **Real-time Chat**: Socket.IO-based bidirectional messaging with typing indicators
- ✅ **Multi-Agent Support**: Assign/unassign conversations, agent queue management
- ✅ **Needs Attention System**: Automatic detection of conversations waiting for agent response
- ✅ **Ticket Management**: Create and track support tickets linked to conversations
- ✅ **Analytics Dashboard**: KPIs, volume charts, response time metrics, CSV export
- ✅ **Embeddable Widget**: One-line script integration for customer-facing chat

### Technical Highlights

- **Backend**: NestJS (TypeScript), Prisma ORM, PostgreSQL, Redis, JWT auth, Socket.IO
- **Frontend**: React 19, Vite, TanStack Query, Tailwind CSS, React Router
- **Security**: Rate limiting, message sanitization, Helmet headers, audit logging
- **Scalability**: Redis adapter for Socket.IO horizontal scaling
- **Testing**: Playwright E2E tests with CI/CD integration
- **Deployment**: Docker containers with health checks and production configs

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
cd backend
npx prisma migrate dev
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
├── backend/          # NestJS backend
│   ├── src/
│   │   ├── auth/    # JWT authentication
│   │   ├── conversations/  # Conversation management
│   │   ├── tickets/        # Ticket system
│   │   ├── realtime/        # Socket.IO gateway
│   │   ├── widget/          # Customer widget API
│   │   ├── analytics/       # Analytics endpoints
│   │   ├── health/          # Health checks
│   │   └── ratelimit/       # Rate limiting
│   └── prisma/      # Database schema & migrations
├── frontend/        # React frontend
│   ├── src/
│   │   ├── pages/   # Route pages
│   │   ├── features/  # Feature modules
│   │   ├── components/  # Reusable components
│   │   └── lib/      # Utilities
│   └── public/      # Static assets
└── docs/            # Documentation & screenshots
```

## Environment Configuration

### Backend (`.env` in `backend/`)

```bash
BACKEND_PORT=3000
BACKEND_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/support_chat?schema=public
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=change_me
JWT_ACCESS_EXPIRES_IN=15m
APP_ORIGIN=http://localhost:5173
WIDGET_TOKEN_EXPIRES_IN=1h
```

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

![Conversation View](./docs/screenshots/conversation.png)
*Active conversation with message thread*

![Widget View](./docs/screenshots/widget.png)
*Customer-facing chat widget*

![Analytics Dashboard](./docs/screenshots/analytics.png)
*Analytics dashboard with KPIs and charts*

See `docs/screenshots/README.md` for instructions on capturing screenshots.

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

# Run migrations
npm run prisma:migrate

# Seed demo data
npm run prisma:seed

# Open Prisma Studio
npm run prisma:studio
```

### Testing

```bash
# E2E tests (requires backend + frontend running)
npm run test:e2e --workspace frontend
```

## Production Deployment

See the [Production Deployment](./README.md#production-deployment) section for Docker-based deployment instructions.

Key production features:
- Multi-stage Docker builds
- Health check endpoints
- Non-root container users
- Environment-based configuration
- Redis-backed Socket.IO scaling

## Security Features

- **Rate Limiting**: Configurable limits on REST and Socket.IO endpoints
- **Message Sanitization**: All user input sanitized before storage
- **Security Headers**: Helmet middleware with safe defaults
- **Audit Logging**: Comprehensive event logging for compliance
- **CORS**: Strict origin validation
- **JWT Authentication**: Secure token-based auth for agents and customers

## Observability & Tracing

The backend includes **OpenTelemetry (OTel) tracing** for comprehensive observability:

### Enabling Tracing

Set environment variables in `backend/.env`:

```bash
OTEL_ENABLED=true
OTEL_SERVICE_NAME=support-chat-backend
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

### Local Tracing Stack

The project includes a Docker Compose setup with OTel Collector and Jaeger:

```bash
# Start tracing stack (along with postgres/redis)
docker-compose up -d
```

This starts:
- **OTel Collector** on port `4318` (OTLP HTTP receiver)
- **Jaeger UI** on port `16686` (http://localhost:16686)

### Viewing Traces

1. **Enable tracing** in `backend/.env`:
   ```bash
   OTEL_ENABLED=true
   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
   ```

2. **Restart the backend** to initialize OTel

3. **Open Jaeger UI**: http://localhost:16686

4. **Search for traces**:
   - Service: `support-chat-backend`
   - Filter by operation (e.g., `ws.message.send`, `GET /api/conversations`)

### Metrics (Prometheus)

The backend exposes Prometheus metrics at `/api/metrics` when `METRICS_ENABLED=true`:

- **HTTP metrics**: Request counts and durations by method/route/status
- **WebSocket metrics**: Connection counts, message counts, event durations
- **Prisma metrics**: Query counts and durations by model/action
- **Rejection metrics**: Counts of rejected messages by reason (rate_limited, validation_error, etc.)

Default metrics (CPU, memory, etc.) are also collected with the `supportchat_` prefix.

### What's Traced

- **HTTP Requests**: All REST API endpoints (auto-instrumented)
- **Prisma Queries**: Database operations with query details
- **Socket.IO Events**: Manual spans for:
  - `ws.connect` - Socket connections
  - `ws.conversation.join` - Conversation room joins
  - `ws.message.send` - Message sending
  - `ws.conversation.claim` - Conversation claiming
  - `ws.conversation.close` - Conversation closing
  - `ws.typing.start/stop` - Typing indicators

### Trace Attributes

Each span includes relevant context:
- `conversationId` - For conversation-related operations
- `actorType` - `agent` or `customer`
- `actorId` - User or customer ID
- `http.request_id` - Correlates with request logging

### Console Exporter (Dev)

If `OTEL_EXPORTER_OTLP_ENDPOINT` is not set, traces are exported to the console for development debugging.

## License

UNLICENSED - Private project
