FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm ci --omit=dev && npm ci --prefix backend

# Copy backend source
COPY backend ./backend

WORKDIR /app/backend

# Placeholder URL so `prisma generate` can resolve schema env(); runtime uses the real value
ENV BACKEND_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/support_chat?schema=public"

# Generate Prisma client before Nest build (types/runtime), then compile
RUN npm run prisma:generate && npm run build


FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy built backend, Prisma schema/migrations, and node_modules (includes prisma CLI from builder)
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/package.json ./package.json
COPY --from=builder /app/backend/prisma ./prisma

EXPOSE 3000

USER appuser

# Apply migrations against the Compose Postgres, then start with OTel entrypoint
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.entry.js"]
