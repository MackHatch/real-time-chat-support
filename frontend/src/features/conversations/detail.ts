import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import type {
  ConversationDetailResponse,
  Ticket,
} from '../../lib/types';

export function useConversation(
  id: string | undefined,
  token: string | null,
) {
  return useQuery({
    queryKey: ['conversation', id],
    queryFn: () =>
      apiFetch<ConversationDetailResponse>(`/conversations/${id}`, {}, { token }),
    enabled: Boolean(token && id),
  });
}

export function useConversationClaim(token: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) =>
      apiFetch(`/conversations/${conversationId}/claim`, { method: 'POST' }, { token }),
    onSuccess: (_data, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
    },
  });
}

export function useConversationClose(token: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) =>
      apiFetch(
        `/conversations/${conversationId}/close`,
        { method: 'POST' },
        { token },
      ),
    onSuccess: (_data, conversationId) => {
      // Optimistic local status so the Close button disappears immediately
      queryClient.setQueryData(
        ['conversation', conversationId],
        (previous: ConversationDetailResponse | undefined) => {
          if (!previous) return previous;
          return {
            ...previous,
            conversation: {
              ...previous.conversation,
              status: 'CLOSED',
            },
          };
        },
      );
      // Refresh inbox lists only — avoid refetching detail while navigating away
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

type CreateTicketInput = {
  conversationId: string;
  title: string;
  priority: 'LOW' | 'MED' | 'HIGH';
};

export function useCreateTicket(token: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTicketInput) =>
      apiFetch<Ticket | { ticket: Ticket }>(
        '/tickets',
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
        { token },
      ),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', input.conversationId] });
    },
  });
}

type AssignConversationInput = {
  conversationId: string;
  agentId?: string | null;
};

export function useConversationAssign(token: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AssignConversationInput) =>
      apiFetch(
        `/conversations/${input.conversationId}/assign`,
        {
          method: 'POST',
          body: JSON.stringify({ agentId: input.agentId ?? null }),
        },
        { token },
      ),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', input.conversationId] });
    },
  });
}
