import { PrismaInstrumentation } from '@prisma/instrumentation';

export function createPrismaInstrumentation(): PrismaInstrumentation {
  return new PrismaInstrumentation({
    // Optional: configure middleware to capture query details
    middleware: true,
  });
}
