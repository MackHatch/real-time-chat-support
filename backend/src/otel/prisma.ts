import { PrismaInstrumentation } from '@prisma/instrumentation';

export function createPrismaInstrumentation(): PrismaInstrumentation {
  return new PrismaInstrumentation();
}
