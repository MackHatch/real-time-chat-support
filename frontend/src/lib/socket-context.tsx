import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { useAuth } from './auth';
import { getAgentSocket, disconnectAgentSocket } from './socket';

type AgentSocketContextValue = {
  socket: Socket | null;
};

const AgentSocketContext = createContext<AgentSocketContextValue | undefined>(
  undefined,
);

export function AgentSocketProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();

  const socket = useMemo(() => {
    if (!token) {
      disconnectAgentSocket();
      return null;
    }
    return getAgentSocket(token);
  }, [token]);

  // Do not disconnect the singleton on provider remount (StrictMode).
  // Sign-out calls disconnectAgentSocket() explicitly.

  const value = useMemo(
    () => ({
      socket,
    }),
    [socket],
  );

  return (
    <AgentSocketContext.Provider value={value}>
      {children}
    </AgentSocketContext.Provider>
  );
}

export function useAgentSocket(): Socket | null {
  const ctx = useContext(AgentSocketContext);
  if (!ctx) {
    throw new Error('useAgentSocket must be used within AgentSocketProvider');
  }
  return ctx.socket;
}
