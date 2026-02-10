import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';

export type Agent = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'AGENT';
};

export type AgentsListResponse = {
  items: Agent[];
};

export function useAgentsList(token: string | null) {
  return useQuery({
    queryKey: ['agents'],
    queryFn: () => apiFetch<AgentsListResponse>('/agents', {}, { token }),
    enabled: Boolean(token),
  });
}
