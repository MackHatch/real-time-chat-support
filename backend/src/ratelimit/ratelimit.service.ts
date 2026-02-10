import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';
import { env } from '../config/env';

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAtMs: number;
};

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private redisClient: RedisClientType | null = null;
  private memoryStore: Map<string, { count: number; resetAt: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Initialize Redis client if available
    if (env.REDIS_URL) {
      this.redisClient = createClient({ url: env.REDIS_URL });
      this.redisClient.on('error', (err) => {
        // eslint-disable-next-line no-console
        console.error('Rate limit Redis client error:', err);
      });
      this.redisClient.connect().catch(() => {
        // Fallback to memory if Redis fails
        this.redisClient = null;
      });
    }

    // Cleanup memory store every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.memoryStore.entries()) {
        if (value.resetAt < now) {
          this.memoryStore.delete(key);
        }
      }
    }, 60000);
  }

  async onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.redisClient) {
      await this.redisClient.quit().catch(() => {
        // Ignore errors on shutdown
      });
    }
  }

  private async consumeRedis(
    key: string,
    max: number,
    windowSec: number,
  ): Promise<RateLimitResult> {
    if (!this.redisClient) {
      throw new Error('Redis client not available');
    }

    const now = Date.now();
    const resetAtMs = now + windowSec * 1000;

    try {
      const count = await this.redisClient.incr(key);
      if (count === 1) {
        await this.redisClient.expire(key, windowSec);
      }

      const remaining = Math.max(0, max - count);
      return {
        allowed: count <= max,
        remaining,
        resetAtMs,
      };
    } catch (error) {
      // Fallback to memory on Redis error
      // eslint-disable-next-line no-console
      console.warn('Rate limit Redis error, falling back to memory:', error);
      return this.consumeMemory(key, max, windowSec);
    }
  }

  private consumeMemory(
    key: string,
    max: number,
    windowSec: number,
  ): RateLimitResult {
    const now = Date.now();
    const resetAtMs = now + windowSec * 1000;

    const entry = this.memoryStore.get(key);
    if (!entry || entry.resetAt < now) {
      // New or expired entry
      this.memoryStore.set(key, { count: 1, resetAt: resetAtMs });
      return {
        allowed: true,
        remaining: max - 1,
        resetAtMs,
      };
    }

    // Existing entry
    entry.count += 1;
    const remaining = Math.max(0, max - entry.count);
    return {
      allowed: entry.count <= max,
      remaining,
      resetAtMs: entry.resetAt,
    };
  }

  async consume(
    key: string,
    max: number,
    windowSec: number,
  ): Promise<RateLimitResult> {
    if (this.redisClient) {
      try {
        return await this.consumeRedis(key, max, windowSec);
      } catch {
        // Fallback to memory
        return this.consumeMemory(key, max, windowSec);
      }
    }

    return this.consumeMemory(key, max, windowSec);
  }
}
