const TYPING_THROTTLE_MS = 500;

const lastTypingByKey: Record<string, number> = {};

function makeKey(socketId: string, conversationId: string): string {
  return `${socketId}:${conversationId}`;
}

export function shouldEmitTyping(
  socketId: string,
  conversationId: string,
): boolean {
  const key = makeKey(socketId, conversationId);
  const now = Date.now();
  const last = lastTypingByKey[key] ?? 0;

  if (now - last < TYPING_THROTTLE_MS) {
    return false;
  }

  lastTypingByKey[key] = now;
  return true;
}

