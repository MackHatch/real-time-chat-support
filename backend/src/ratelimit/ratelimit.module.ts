import { Module } from '@nestjs/common';
import { RateLimitService } from './ratelimit.service';

@Module({
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitModule {}
