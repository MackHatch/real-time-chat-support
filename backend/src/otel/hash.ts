import { createHmac } from 'crypto';
import { env } from '../config/env';

/**
 * Hash an identifier using HMAC-SHA256 with a secret key, returning a short
 * stable hex string. This is used to avoid putting raw IDs/emails in traces.
 */
export function hashId(input: string): string {
  const hmac = createHmac('sha256', env.TRACE_ID_HASH_SECRET);
  hmac.update(input);
  return hmac.digest('hex').slice(0, 16);
}

export function hashMaybe(input?: string | null): string | undefined {
  if (!input) return undefined;
  return hashId(input);
}

