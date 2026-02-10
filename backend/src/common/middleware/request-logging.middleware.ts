import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { setSpanAttribute } from '../otel/tracing';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    const incomingId = (req.headers['x-request-id'] as string | undefined) ?? null;
    const requestId = incomingId || randomUUID();

    res.setHeader('x-request-id', requestId);

    // Set request ID on active span if OTel is enabled
    setSpanAttribute('http.request_id', requestId);

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const log = {
        requestId,
        method: req.method,
        path: (req as any).originalUrl || req.url,
        status: res.statusCode,
        durationMs,
      };
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(log));
    });

    next();
  }
}

