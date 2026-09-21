import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import type {
  ConversationListResponse,
  ConversationListItem,
} from '../../lib/types';

type ConversationListParams = {
  status?: string;
  assigned?: 'me' | 'unassigned' | 'all';
  inboxId?: string;
  page?: number;
  pageSize?: number;
  needsAttention?: boolean;
};

export function useConversationsList(
  params: ConversationListParams,
  token: string | null,
) {
  return useQuery({
    queryKey: ['conversations', params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params.status) searchParams.set('status', params.status);
      if (params.assigned) searchParams.set('assigned', params.assigned);
      if (params.inboxId) searchParams.set('inboxId', params.inboxId);
      if (params.page) searchParams.set('page', String(params.page));
      if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
      if (params.needsAttention !== undefined) {
        searchParams.set('needsAttention', String(params.needsAttention));
      }

      const query = searchParams.toString();
      const path = `/conversations${query ? `?${query}` : ''}`;

      return apiFetch<ConversationListResponse>(path, {}, { token });
    },
    enabled: Boolean(token),
  });
}

export function useClaimConversation(token: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => {
      return apiFetch<ConversationListItem>(
        `/conversations/${conversationId}/claim`,
        {
          method: 'POST',
        },
        { token },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
