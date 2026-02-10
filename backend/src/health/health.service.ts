import { Injectable } from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '../config/env';

type HealthCheckResult = {
  ok: boolean;
  db: {
    ok: boolean;
    latencyMs: number | null;
  };
  redis: {
    ok: boolean;
    latencyMs: number | null;
    enabled: boolean;
  };
  time: string;
  version: string;
};

@Injectable()
export class HealthService {
  private redisClient: RedisClientType | null = null;
  private readonly version = '0.1.0';

  constructor(private readonly prisma: PrismaService) {}

  private async checkDb(): Promise<{ ok: boolean; latencyMs: number | null }> {
    const start = Date.now();
    try {
      // Simple connectivity check
      await this.prisma.$queryRaw`SELECT 1`;
      const latencyMs = Date.now() - start;
      return { ok: true, latencyMs };
    } catch {
      return { ok: false, latencyMs: null };
    }
  }

  private async getRedisClient(): Promise<RedisClientType | null> {
    if (!env.REDIS_URL) {
      return null;
    }

    if (this.redisClient) {
      return this.redisClient;
    }

    const client: RedisClientType = createClient({
      url: env.REDIS_URL,
    });

    client.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('Health Redis client error:', err);
    });

    await client.connect();
    this.redisClient = client;
    return this.redisClient;
  }

  private async checkRedis(): Promise<{
    ok: boolean;
    latencyMs: number | null;
    enabled: boolean;
  }> {
    if (!env.REDIS_URL) {
      return { ok: true, latencyMs: null, enabled: false };
    }

    const client = await this.getRedisClient();
    if (!client) {
      return { ok: false, latencyMs: null, enabled: true };
    }

    const start = Date.now();
    try {
      await client.ping();
      const latencyMs = Date.now() - start;
      return { ok: true, latencyMs, enabled: true };
    } catch {
      return { ok: false, latencyMs: null, enabled: true };
    }
  }

  async check(): Promise<HealthCheckResult> {
    const [db, redis] = await Promise.all([this.checkDb(), this.checkRedis()]);

    const ok = db.ok && (!redis.enabled || redis.ok);

    return {
      ok,
      db,
      redis,
      time: new Date().toISOString(),
      version: this.version,
    };
  }
}

