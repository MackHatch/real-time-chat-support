import { trace, context, SpanStatusCode, Span } from '@opentelemetry/api';

export const tracer = trace.getTracer('support-chat');

export type SpanAttributes = Record<string, string | number | boolean | undefined>;

/**
 * Starts a new span with the given name and attributes
 */
export function startSpan(
  name: string,
  attributes?: SpanAttributes,
): Span {
  const span = tracer.startSpan(name);
  if (attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== undefined) {
        span.setAttribute(key, value);
      }
    });
  }
  return span;
}

/**
 * Runs a function within a span context, automatically handling errors and status
 */
export async function runWithSpan<T>(
  name: string,
  attributes: SpanAttributes | undefined,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const span = tracer.startSpan(name);
  if (attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== undefined) {
        span.setAttribute(key, value);
      }
    });
  }

  try {
    const result = await context.with(trace.setSpan(context.active(), span), async () => {
      return await fn(span);
    });
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Sets an attribute on the active span if one exists
 */
export function setSpanAttribute(key: string, value: string | number | boolean): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttribute(key, value);
  }
}
