FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY frontend/package*.json ./frontend/

RUN npm ci --omit=dev && npm ci --prefix frontend

COPY frontend ./frontend

WORKDIR /app/frontend

# Build SPA and widget loader
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

RUN npm run build && npm run build:widget


FROM nginx:1.27-alpine AS runner

WORKDIR /usr/share/nginx/html

COPY --from=builder /app/frontend/dist ./
COPY --from=builder /app/frontend/public/widget.js ./widget.js
COPY --from=builder /app/frontend/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

