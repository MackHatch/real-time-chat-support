import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;

  readonly httpRequestsTotal: Counter<string>;
  readonly httpRequestDurationMs: Histogram<string>;

  readonly wsConnectionsTotal: Counter<string>;
  readonly wsMessagesTotal: Counter<string>;
  readonly wsMessageRejectedTotal: Counter<string>;
  readonly wsEventDurationMs: Histogram<string>;

  readonly prismaQueryTotal: Counter<string>;
  readonly prismaQueryDurationMs: Histogram<string>;

  constructor() {
    this.registry = new Registry();

    collectDefaultMetrics({
      register: this.registry,
      prefix: 'supportchat_',
    });

    this.httpRequestsTotal = new Counter({
      name: 'supportchat_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDurationMs = new Histogram({
      name: 'supportchat_http_request_duration_ms',
      help: 'HTTP request duration in milliseconds',
      labelNames: ['method', 'route'],
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000],
      registers: [this.registry],
    });

    this.wsConnectionsTotal = new Counter({
      name: 'supportchat_ws_connections_total',
      help: 'Total number of WebSocket connections',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.wsMessagesTotal = new Counter({
      name: 'supportchat_ws_messages_total',
      help: 'Total number of WebSocket messages',
      labelNames: ['event', 'actor_type'],
      registers: [this.registry],
    });

    this.wsMessageRejectedTotal = new Counter({
      name: 'supportchat_ws_message_rejected_total',
      help: 'Total number of rejected WebSocket messages',
      labelNames: ['reason'],
      registers: [this.registry],
    });

    this.wsEventDurationMs = new Histogram({
      name: 'supportchat_ws_event_duration_ms',
      help: 'WebSocket event handling duration in milliseconds',
      labelNames: ['event'],
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
      registers: [this.registry],
    });

    this.prismaQueryTotal = new Counter({
      name: 'supportchat_prisma_query_total',
      help: 'Total number of Prisma queries',
      labelNames: ['model', 'action'],
      registers: [this.registry],
    });

    this.prismaQueryDurationMs = new Histogram({
      name: 'supportchat_prisma_query_duration_ms',
      help: 'Prisma query duration in milliseconds',
      labelNames: ['model', 'action'],
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
      registers: [this.registry],
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}

