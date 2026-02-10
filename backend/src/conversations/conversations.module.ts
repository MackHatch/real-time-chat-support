import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { RateLimitModule } from '../ratelimit/ratelimit.module';

@Module({
  imports: [PrismaModule, RealtimeModule, RateLimitModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
})
export class ConversationsModule {}

