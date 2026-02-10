FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm ci --omit=dev && npm ci --prefix backend

# Copy backend source
COPY backend ./backend

WORKDIR /app/backend

# Build backend and generate Prisma client
RUN npm run build && npm run prisma:generate


FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy built backend
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/package.json ./package.json

EXPOSE 3000

USER appuser

CMD ["node", "dist/main.js"]

