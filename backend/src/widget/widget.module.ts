import { Module } from '@nestjs/common';
import { WidgetController } from './widget.controller';
import { WidgetService } from './widget.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RateLimitModule } from '../ratelimit/ratelimit.module';

@Module({
  imports: [PrismaModule, AuthModule, RateLimitModule],
  controllers: [WidgetController],
  providers: [WidgetService],
})
export class WidgetModule {}

