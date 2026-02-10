import { io, Socket } from 'socket.io-client';

const socketBaseUrl = (import.meta.env.VITE_SOCKET_URL ?? '').replace(/\/+$/, '');

let agentSocket: Socket | null = null;
let currentAgentToken: string | null = null;

export function getAgentSocket(token: string): Socket {
  if (agentSocket && currentAgentToken === token) {
    return agentSocket;
  }

  if (agentSocket) {
    agentSocket.disconnect();
  }

  currentAgentToken = token;
  agentSocket = io(socketBaseUrl, {
    auth: { token },
  });

  return agentSocket;
}

export function disconnectAgentSocket() {
  if (agentSocket) {
    agentSocket.disconnect();
    agentSocket = null;
    currentAgentToken = null;
  }
}

export function createCustomerSocket(customerToken: string): Socket {
  return io(socketBaseUrl, {
    auth: { token: customerToken },
  });
}

