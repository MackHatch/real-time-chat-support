import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { createPrismaInstrumentation } from './prisma';

let sdk: NodeSDK | null = null;

export function initOtel(): void {
  const enabled = process.env.OTEL_ENABLED === 'true';
  if (!enabled) {
    // eslint-disable-next-line no-console
    console.log('[OTel] Tracing disabled (OTEL_ENABLED=false)');
    return;
  }

  const serviceName =
    process.env.OTEL_SERVICE_NAME || 'support-chat-backend';
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  // Build resource
  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: serviceName,
  });

  // Configure trace exporter
  let traceExporter;
  if (otlpEndpoint) {
    // OTLP HTTP exporter
    const url = otlpEndpoint.endsWith('/v1/traces')
      ? otlpEndpoint
      : `${otlpEndpoint}/v1/traces`;
    traceExporter = new OTLPTraceExporter({
      url,
    });
    // eslint-disable-next-line no-console
    console.log(`[OTel] Initializing with OTLP exporter: ${url}`);
  } else {
    // Console exporter for dev
    traceExporter = new ConsoleSpanExporter();
    // eslint-disable-next-line no-console
    console.log('[OTel] Initializing with console exporter (dev mode)');
  }

  // Create SDK
  sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable fs instrumentation as it can be noisy
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
      }),
      createPrismaInstrumentation(),
    ],
    // Use batch span processor for better performance
  });

  // Start SDK
  sdk.start();

  // Handle shutdown
  const shutdown = async () => {
    if (sdk) {
      await sdk.shutdown();
      // eslint-disable-next-line no-console
      console.log('[OTel] Shutdown complete');
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // eslint-disable-next-line no-console
  console.log(`[OTel] Tracing initialized for service: ${serviceName}`);
}
