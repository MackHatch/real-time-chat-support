// This file must be the entry point to ensure OTel is initialized before NestJS
// Import and initialize OTel first (before any other imports)
import { initOtel } from './otel/otel';

// Initialize OTel before anything else
initOtel();

// Now import and bootstrap the NestJS app
import { bootstrap } from './main';

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start application:', error);
  process.exit(1);
});
