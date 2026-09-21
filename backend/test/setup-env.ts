process.env.BACKEND_PORT ??= '3000';
process.env.BACKEND_DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/support_chat?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'test_secret_key_min_8_chars';
process.env.JWT_ACCESS_EXPIRES_IN ??= '15m';
process.env.APP_ORIGIN ??= 'http://localhost:5173';
process.env.WIDGET_TOKEN_EXPIRES_IN ??= '1h';
process.env.RATE_LIMIT_ENABLED ??= 'true';
process.env.AUTH_LOGIN_MAX ??= '10';
process.env.WIDGET_SESSION_MAX ??= '30';
process.env.CLAIM_MAX ??= '30';
process.env.ASSIGN_MAX ??= '30';
process.env.SOCKET_MESSAGE_MAX_PER_10S ??= '20';
process.env.METRICS_ENABLED ??= 'false';
process.env.OTEL_ENABLED ??= 'false';
// Prefer in-memory rate limiting in unit tests
delete process.env.REDIS_URL;
