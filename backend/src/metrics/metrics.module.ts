import { Global, Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';

@Global()
@Module({
  providers: [MetricsService, HttpMetricsInterceptor],
  controllers: [MetricsController],
  exports: [MetricsService, HttpMetricsInterceptor],
})
export class MetricsModule {}

