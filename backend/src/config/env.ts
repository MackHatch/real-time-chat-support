import { z } from 'zod';

const EnvSchema = z
  .object({
    BACKEND_PORT: z.coerce.number().int().positive().default(3000),
    BACKEND_DATABASE_URL: z.string().min(1, 'BACKEND_DATABASE_URL is required'),
    REDIS_URL: z.string().min(1).optional(),
    ENABLE_SOCKET_REDIS_ADAPTER: z
      .string()
      .transform((val) => val === 'true')
      .default('false'),
    JWT_ACCESS_SECRET: z
      .string()
      .min(8, 'JWT_ACCESS_SECRET should be at least 8 characters long'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    APP_ORIGIN: z.string().min(1, 'APP_ORIGIN is required'),
    WIDGET_TOKEN_EXPIRES_IN: z.string().default('1h'),
    RATE_LIMIT_ENABLED: z
      .string()
      .transform((val) => val === 'true')
      .default('true'),
    RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
    AUTH_LOGIN_MAX: z.coerce.number().int().positive().default(10),
    WIDGET_SESSION_MAX: z.coerce.number().int().positive().default(30),
    CLAIM_MAX: z.coerce.number().int().positive().default(30),
    ASSIGN_MAX: z.coerce.number().int().positive().default(30),
    SOCKET_MESSAGE_MAX_PER_10S: z.coerce.number().int().positive().default(20),
    METRICS_ENABLED: z
      .string()
      .transform((val) => val === 'true')
      .default('true'),
    OTEL_ENABLED: z
      .string()
      .transform((val) => val === 'true')
      .default('false'),
    OTEL_SERVICE_NAME: z.string().default('support-chat-backend'),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
    TRACE_ID_HASH_SECRET: z
      .string()
      .min(16, 'TRACE_ID_HASH_SECRET should be at least 16 characters long')
      .default('change_me_change_me_change_me'),
  })
  .refine(
    (data) => {
      if (data.ENABLE_SOCKET_REDIS_ADAPTER && !data.REDIS_URL) {
        return false;
      }
      return true;
    },
    {
      message:
        'REDIS_URL is required when ENABLE_SOCKET_REDIS_ADAPTER is enabled',
      path: ['REDIS_URL'],
    },
  );

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);

