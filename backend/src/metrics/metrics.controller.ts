import { Controller, Get, Header, NotFoundException } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { env } from '../config/env';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getMetrics(): Promise<string> {
    if (!env.METRICS_ENABLED) {
      throw new NotFoundException();
    }

    return this.metricsService.getMetrics();
  }
}

