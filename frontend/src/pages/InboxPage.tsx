import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useConversationsList, useClaimConversation } from '../features/conversations/queries';
import { useAgentSocket } from '../lib/socket-context';
import { useRealtimeInvalidation } from '../features/realtime/useRealtimeInvalidation';
import { timeAgo } from '../lib/time';
import type { ConversationListItem } from '../lib/types';
import { ApiError } from '../lib/api';

function getCustomerDisplayName(customer: ConversationListItem['customer']): string {
  return customer.name || customer.email || customer.externalId || customer.id;
}

function parseAssignedFilter(
  value: string | null,
): 'me' | 'unassigned' | 'all' {
  if (value === 'unassigned' || value === 'all') return value;
  return 'me';
}

export function InboxPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const socket = useAgentSocket();
  // Initialize from the URL so the first fetch matches ?assigned=… (no me→unassigned race)
  const [assignedFilter, setAssignedFilter] = useState<'me' | 'unassigned' | 'all'>(
    () => parseAssignedFilter(searchParams.get('assigned')),
  );
  const [needsAttentionFilter, setNeedsAttentionFilter] = useState<boolean | undefined>(
    () => (searchParams.get('needsAttention') === 'true' ? true : undefined),
  );
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    setAssignedFilter(parseAssignedFilter(searchParams.get('assigned')));
    setNeedsAttentionFilter(
      searchParams.get('needsAttention') === 'true' ? true : undefined,
    );
  }, [searchParams]);

  const setAssigned = (next: 'me' | 'unassigned' | 'all') => {
    setAssignedFilter(next);
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (next === 'me') {
      params.delete('assigned');
    } else {
      params.set('assigned', next);
    }
    setSearchParams(params, { replace: true });
  };

  const { data, isLoading, error } = useConversationsList(
    {
      status: 'OPEN',
      assigned: assignedFilter,
      page,
      pageSize,
      needsAttention: needsAttentionFilter,
    },
    token,
  );

  const claimMutation = useClaimConversation(token);
  const [claimError, setClaimError] = useState<string | null>(null);

  useRealtimeInvalidation(socket);

  const handleClaim = async (conversationId: string) => {
    setClaimError(null);
    try {
      await claimMutation.mutateAsync(conversationId);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setClaimError('This conversation has already been claimed.');
        } else {
          setClaimError(err.message || 'Failed to claim conversation.');
        }
      } else {
        setClaimError('Failed to claim conversation.');
      }
    }
  };

  const handleConversationClick = (id: string) => {
    navigate(`/app/conversations/${id}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Inbox</h1>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2 border-b border-slate-800">
          <button
            type="button"
            onClick={() => setAssigned('me')}
            data-testid="inbox-toggle-assigned"
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              assignedFilter === 'me'
                ? 'border-slate-400 text-slate-100'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Assigned to me
          </button>
          <button
            type="button"
            onClick={() => setAssigned('unassigned')}
            data-testid="inbox-toggle-unassigned"
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              assignedFilter === 'unassigned'
                ? 'border-slate-400 text-slate-100'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Unassigned
          </button>
          <button
            type="button"
            onClick={() => setAssigned('all')}
            data-testid="inbox-toggle-all"
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              assignedFilter === 'all'
                ? 'border-slate-400 text-slate-100'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            All
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setNeedsAttentionFilter(
                needsAttentionFilter === true ? undefined : true,
              );
              setPage(1);
            }}
            data-testid="inbox-filter-attention"
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              needsAttentionFilter === true
                ? 'bg-orange-900 text-orange-200'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Needs attention
          </button>
        </div>
      </div>

      {claimError && (
        <div className="rounded-md bg-red-900/20 border border-red-800 px-3 py-2 text-sm text-red-400">
          {claimError}
        </div>
      )}

      {isLoading && (
        <div className="text-sm text-slate-400">Loading conversations...</div>
      )}

      {error && (
        <div className="rounded-md bg-red-900/20 border border-red-800 px-3 py-2 text-sm text-red-400">
          {error instanceof Error ? error.message : 'Failed to load conversations.'}
        </div>
      )}

      {data && (
        <>
          <div data-testid="convo-list" className="space-y-2">
            {data.items.length === 0 ? (
              <div className="text-sm text-slate-400 py-8 text-center">
                No conversations found.
              </div>
            ) : (
              data.items.map((conversation) => (
                <div
                  key={conversation.id}
                  data-testid={`convo-item-${conversation.id}`}
                  className="rounded-md border border-slate-800 bg-slate-950/50 p-4 hover:bg-slate-950 transition-colors cursor-pointer"
                  onClick={() => handleConversationClick(conversation.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-slate-100 truncate">
                          {getCustomerDisplayName(conversation.customer)}
                        </span>
                        <span className="text-xs text-slate-500">
                          {conversation.inbox.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                        <span>{timeAgo(conversation.lastMessageAt)}</span>
                        {conversation.needsAttention && (
                          <span
                            data-testid={`convo-attention-badge-${conversation.id}`}
                            className="px-1.5 py-0.5 rounded bg-orange-900/50 text-orange-300 font-medium"
                          >
                            Unreplied
                          </span>
                        )}
                        {conversation.needsAttention && conversation.lastCustomerMessageAt && (
                          <span className="text-orange-400">
                            Customer waiting: {timeAgo(conversation.lastCustomerMessageAt)}
                          </span>
                        )}
                        {conversation.assignedAgentId ? (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            Me
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-yellow-900/30 text-yellow-400">
                            Unassigned
                          </span>
                        )}
                        {conversation.ticket && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-400">
                            Ticket
                          </span>
                        )}
                      </div>
                    </div>
                    {!conversation.assignedAgentId && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClaim(conversation.id);
                        }}
                        data-testid={`convo-claim-${conversation.id}`}
                        disabled={claimMutation.isPending}
                        className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 text-slate-100 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {claimMutation.isPending ? 'Claiming...' : 'Claim'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {data.total > pageSize && (
            <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-800">
              <div className="text-sm text-slate-400">
                Showing {(page - 1) * pageSize + 1}-
                {Math.min(page * pageSize, data.total)} of {data.total}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm rounded-md bg-slate-800 text-slate-100 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * pageSize >= data.total}
                  className="px-3 py-1.5 text-sm rounded-md bg-slate-800 text-slate-100 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
