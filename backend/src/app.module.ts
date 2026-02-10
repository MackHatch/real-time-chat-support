import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { InboxesModule } from './inboxes/inboxes.module';
import { ConversationsModule } from './conversations/conversations.module';
import { TicketsModule } from './tickets/tickets.module';
import { RealtimeModule } from './realtime/realtime.module';
import { WidgetModule } from './widget/widget.module';
import { AgentsModule } from './agents/agents.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { HealthModule } from './health/health.module';
import { RateLimitModule } from './ratelimit/ratelimit.module';
import { MetricsModule } from './metrics/metrics.module';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuthModule,
    InboxesModule,
    ConversationsModule,
    TicketsModule,
    RealtimeModule,
    WidgetModule,
    AgentsModule,
    AnalyticsModule,
    HealthModule,
    RateLimitModule,
    MetricsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}
