import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { MetricsService } from './metrics.service';
import { env } from '../config/env';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    if (!env.METRICS_ENABLED) {
      return next.handle();
    }

    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<Request>();
    const res = httpCtx.getResponse<Response>();

    const start = Date.now();
    const method = (req.method || 'GET').toUpperCase();
    
    // Normalize route: replace UUIDs and IDs with :id pattern
    let route =
      (req.route && req.route.path) ||
      (req as any).originalUrl?.split('?')[0] ||
      (req.path as string) ||
      'unknown';
    
    // Replace UUIDs and common ID patterns with :id
    route = route.replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '/:id',
    );
    route = route.replace(/\/\d+/g, '/:id');

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - start;
          const status = res.statusCode || 0;

          try {
            this.metrics.httpRequestsTotal.inc({
              method,
              route,
              status: String(status),
            });

            this.metrics.httpRequestDurationMs.observe(
              { method, route },
              durationMs,
            );
          } catch {
            // Ignore metrics errors to prevent breaking requests
          }
        },
        error: () => {
          const durationMs = Date.now() - start;
          const status = res.statusCode || 500;

          try {
            this.metrics.httpRequestsTotal.inc({
              method,
              route,
              status: String(status),
            });

            this.metrics.httpRequestDurationMs.observe(
              { method, route },
              durationMs,
            );
          } catch {
            // Ignore metrics errors
          }
        },
      }),
    );
  }
}

