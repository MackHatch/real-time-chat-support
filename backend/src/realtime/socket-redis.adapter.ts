import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import type { Env } from '../config/env';

export async function maybeAttachRedisAdapter(
  server: Server,
  env: Env,
): Promise<void> {
  if (!env.ENABLE_SOCKET_REDIS_ADAPTER) {
    return;
  }

  if (!env.REDIS_URL) {
    throw new Error(
      'REDIS_URL is required when ENABLE_SOCKET_REDIS_ADAPTER is enabled',
    );
  }

  try {
    const pubClient = createClient({ url: env.REDIS_URL });
    const subClient = pubClient.duplicate();

    await pubClient.connect();
    await subClient.connect();

    server.adapter(createAdapter(pubClient, subClient));

    // Graceful shutdown handlers
    const cleanup = async () => {
      try {
        await pubClient.quit();
        await subClient.quit();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error closing Redis clients:', err);
      }
    };

    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
    process.on('exit', cleanup);

    // eslint-disable-next-line no-console
    console.log('Socket.IO Redis adapter attached successfully');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to attach Redis adapter:', error);
    throw error;
  }
}
