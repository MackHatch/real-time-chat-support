import { Module } from '@nestjs/common';
import { AgentChatGateway } from './chat.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RateLimitModule } from '../ratelimit/ratelimit.module';

@Module({
  imports: [PrismaModule, AuthModule, RateLimitModule],
  providers: [AgentChatGateway],
  exports: [AgentChatGateway],
})
export class RealtimeModule {}

