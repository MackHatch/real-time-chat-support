import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import type { TicketDetail, TicketListResponse } from '../../lib/types';

type TicketListParams = {
  status?: string;
  assigned?: 'me' | 'all';
  page?: number;
  pageSize?: number;
};

export function useTicketsList(
  params: TicketListParams,
  token: string | null,
) {
  return useQuery({
    queryKey: ['tickets', params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params.status) searchParams.set('status', params.status);
      if (params.assigned) searchParams.set('assigned', params.assigned);
      if (params.page) searchParams.set('page', String(params.page));
      if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));

      const query = searchParams.toString();
      const path = `/tickets${query ? `?${query}` : ''}`;

      return apiFetch<TicketListResponse>(path, {}, { token });
    },
    enabled: Boolean(token),
  });
}

export function useTicket(id: string | undefined, token: string | null) {
  return useQuery({
    queryKey: ['ticket', id],
    queryFn: () => apiFetch<TicketDetail>(`/tickets/${id}`, {}, { token }),
    enabled: Boolean(token && id),
  });
}

type UpdateTicketInput = {
  status?: string;
  priority?: 'LOW' | 'MED' | 'HIGH';
  assignedAgentId?: string;
};

export function useUpdateTicket(id: string | undefined, token: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTicketInput) => {
      return apiFetch<TicketDetail>(
        `/tickets/${id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(input),
        },
        { token },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
    },
  });
}
