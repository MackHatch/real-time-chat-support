import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RateLimitService } from './ratelimit.service';
import { RATE_LIMIT_KEY, RateLimitOptions } from './ratelimit.decorator';
import { env } from '../config/env';

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    // Skip if rate limiting is disabled
    if (!env.RATE_LIMIT_ENABLED) {
      return next.handle();
    }

    const options = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );

    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    
    // Resolve key parts (replace placeholders)
    const resolvedKeyParts = options.keyParts.map((part) => {
      if (part === '{ip}') {
        const forwarded = request.headers['x-forwarded-for'];
        const ip = forwarded
          ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim())
          : request.ip || request.socket.remoteAddress || 'unknown';
        return ip;
      }
      if (part === '{userId}') {
        // Extract from request.user (set by JWT guard)
        const user = (request as any).user;
        return user?.userId || 'unknown';
      }
      if (part.startsWith('{') && part.endsWith('}')) {
        // Extract from request body or params
        const key = part.slice(1, -1);
        return (request.body?.[key] || request.params?.[key] || 'unknown') as string;
      }
      return part;
    });
    
    const key = `rl:${resolvedKeyParts.join(':')}`;

    const result = await this.rateLimitService.consume(
      key,
      options.max,
      options.windowSec,
    );

    // Set rate limit headers
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', options.max);
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader(
      'X-RateLimit-Reset',
      Math.ceil(result.resetAtMs / 1000).toString(),
    );

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAtMs - Date.now()) / 1000);
      response.setHeader('Retry-After', retryAfter.toString());

      throw new HttpException(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Rate limit exceeded. Please try again later.',
            details: {
              retryAfterSeconds: retryAfter,
            },
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return next.handle();
  }
}
