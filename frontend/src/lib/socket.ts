import { io, Socket } from 'socket.io-client';

const rawSocketUrl = import.meta.env.VITE_SOCKET_URL;
const socketBaseUrl =
  typeof rawSocketUrl === 'string' && rawSocketUrl.trim().length > 0
    ? rawSocketUrl.replace(/\/+$/, '')
    : undefined;

let agentSocket: Socket | null = null;
let currentAgentToken: string | null = null;

export function getAgentSocket(token: string): Socket {
  // Recreate if token changed or the cached socket was disconnected
  // (React StrictMode remounts used to disconnect the singleton and leave a dead socket).
  if (
    agentSocket &&
    currentAgentToken === token &&
    (agentSocket.connected || agentSocket.active)
  ) {
    return agentSocket;
  }

  if (agentSocket) {
    agentSocket.removeAllListeners();
    agentSocket.disconnect();
    agentSocket = null;
  }

  currentAgentToken = token;
  agentSocket = io(socketBaseUrl, {
    auth: { token },
    autoConnect: true,
    reconnection: true,
  });

  return agentSocket;
}

export function disconnectAgentSocket() {
  if (agentSocket) {
    agentSocket.removeAllListeners();
    agentSocket.disconnect();
    agentSocket = null;
    currentAgentToken = null;
  }
}

export function createCustomerSocket(customerToken: string): Socket {
  return io(socketBaseUrl, {
    auth: { token: customerToken },
    autoConnect: true,
    reconnection: true,
  });
}
