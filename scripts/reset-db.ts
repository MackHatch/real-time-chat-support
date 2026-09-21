import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const backendDir = join(process.cwd(), 'backend');

if (!existsSync(backendDir)) {
  console.error('Backend directory not found');
  process.exit(1);
}

const databaseUrl = process.env.BACKEND_DATABASE_URL;

if (!databaseUrl) {
  console.error('BACKEND_DATABASE_URL must be set');
  process.exit(1);
}

console.log('Resetting database...');

try {
  // Run prisma migrate reset (drops and recreates schema, then seeds)
  execSync('npm run prisma:migrate:reset', {
    cwd: backendDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      BACKEND_DATABASE_URL: databaseUrl,
    },
  });

  console.log('Database reset complete');
} catch (error) {
  console.error('Failed to reset database:', error);
  process.exit(1);
}
