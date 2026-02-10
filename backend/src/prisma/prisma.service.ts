import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly metrics?: MetricsService) {
    super({
      datasources: {
        db: {
          url: env.BACKEND_DATABASE_URL,
        },
      },
    });

    if (env.METRICS_ENABLED && this.metrics) {
      this.$use(async (params, next) => {
        const start = Date.now();
        try {
          const result = await next(params);
          const durationMs = Date.now() - start;
          const model = params.model ?? 'raw';
          const action = params.action ?? 'unknown';

          try {
            this.metrics.prismaQueryTotal.inc({ model, action });
            this.metrics.prismaQueryDurationMs.observe(
              { model, action },
              durationMs,
            );
          } catch {
            // Ignore metrics errors
          }

          return result;
        } catch (error) {
          const durationMs = Date.now() - start;
          const model = params.model ?? 'raw';
          const action = params.action ?? 'unknown';

          try {
            this.metrics.prismaQueryTotal.inc({ model, action });
            this.metrics.prismaQueryDurationMs.observe(
              { model, action },
              durationMs,
            );
          } catch {
            // Ignore metrics errors
          }

          throw error;
        }
      });
    }
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

