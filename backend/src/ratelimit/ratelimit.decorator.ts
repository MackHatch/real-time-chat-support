import { applyDecorators, SetMetadata, UseInterceptors } from '@nestjs/common';
import { RateLimitInterceptor } from './ratelimit.interceptor';

export type RateLimitOptions = {
  keyParts: string[];
  max: number;
  windowSec: number;
};

export const RATE_LIMIT_KEY = 'rateLimit';

export function RateLimit(options: RateLimitOptions) {
  return applyDecorators(
    SetMetadata(RATE_LIMIT_KEY, options),
    UseInterceptors(RateLimitInterceptor),
  );
}
