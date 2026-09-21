import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { useAgentSocket } from '../lib/socket-context';
import {
  useConversation,
  useConversationClaim,
  useConversationClose,
  useCreateTicket,
  useConversationAssign,
} from '../features/conversations/detail';
import { useAgentsList } from '../features/agents/queries';
import type { Message } from '../lib/types';
import { timeAgo } from '../lib/time';
import { ApiError } from '../lib/api';
import { useRealtimeInvalidation } from '../features/realtime/useRealtimeInvalidation';

type UiMessage = Message & { __optimistic?: boolean };

function getCustomerDisplayName(customer: {
  id: string;
  name?: string | null;
  email?: string | null;
  externalId?: string | null;
}): string {
  return customer.name || customer.email || customer.externalId || customer.id;
}

export function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token, user } = useAuth();
  const socket = useAgentSocket();

  const { data, isLoading, error } = useConversation(id, token);
  const { data: agentsData } = useAgentsList(token);

  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [customerTyping, setCustomerTyping] = useState(false);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketPriority, setTicketPriority] = useState<'LOW' | 'MED' | 'HIGH'>('MED');
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);

  const claimMutation = useConversationClaim(token);
  const closeMutation = useConversationClose(token);
  const createTicketMutation = useCreateTicket(token);
  const assignMutation = useConversationAssign(token);

  useRealtimeInvalidation(socket);

  useEffect(() => {
    if (!data) return;

    const sorted = [...data.messages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    setMessages(sorted);
  }, [data]);

  useEffect(() => {
    if (!socket || !id) return;

    const join = () => {
      socket.emit('conversation.join', { conversationId: id });
    };

    join();
    socket.on('connect', join);

    return () => {
      socket.off('connect', join);
    };
  }, [socket, id]);

  useEffect(() => {
    if (!socket || !id) return;

    const handleMessageCreated = (payload: { conversationId: string; message: Message }) => {
      if (payload.conversationId !== id) return;

      setMessages((prev) => {
        const withoutOptimistic = prev.filter(
          (m) => !(m.__optimistic && m.body === payload.message.body),
        );
        const exists = withoutOptimistic.some((m) => m.id === payload.message.id);
        if (exists) return withoutOptimistic;
        return [...withoutOptimistic, payload.message];
      });
    };

    const handleTypingUpdated = (payload: {
      conversationId: string;
      isTyping: boolean;
      actorType?: string;
    }) => {
      if (payload.conversationId !== id) return;
      if (payload.actorType && payload.actorType !== 'customer') return;

      if (payload.isTyping) {
        setCustomerTyping(true);
      } else {
        setCustomerTyping(false);
      }
    };

    const handleConversationUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };

    socket.on('message.created', handleMessageCreated);
    socket.on('typing.updated', handleTypingUpdated);
    socket.on('conversation.updated', handleConversationUpdated);

    return () => {
      socket.off('message.created', handleMessageCreated);
      socket.off('typing.updated', handleTypingUpdated);
      socket.off('conversation.updated', handleConversationUpdated);
    };
  }, [socket, id, queryClient]);

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    if (!socket || !id) return;
    const trimmed = input.trim();
    if (!trimmed) return;

    setSendError(null);

    const optimistic: UiMessage = {
      id: `local-${Date.now()}`,
      conversationId: id,
      senderType: 'AGENT',
      senderUserId: null,
      senderCustomerId: null,
      body: trimmed,
      createdAt: new Date().toISOString(),
      __optimistic: true,
    };

    setMessages((prev) => [...prev, optimistic]);
    setInput('');

    socket.emit(
      'message.send',
      { conversationId: id, body: trimmed },
      (ack: { error?: { message?: string }; ok?: boolean; message?: Message } | null) => {
        if (ack?.error) {
          setSendError(ack.error.message ?? 'Failed to send message.');
          setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
          return;
        }

        // Prefer ack payload so UI clears "Sending…" even if room broadcast is missed
        if (ack?.message) {
          setMessages((prev) => {
            const withoutOptimistic = prev.filter((m) => m.id !== optimistic.id);
            const exists = withoutOptimistic.some((m) => m.id === ack.message!.id);
            if (exists) return withoutOptimistic;
            return [...withoutOptimistic, ack.message!];
          });
        }
      },
    );
  };

  const handleClaim = async () => {
    if (!id) return;
    try {
      await claimMutation.mutateAsync(id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // already claimed; realtime updates will refresh state
      }
    }
  };

  const handleClose = async () => {
    if (!id) return;
    setCloseError(null);
    try {
      await closeMutation.mutateAsync(id);
      navigate('/app/inbox', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setCloseError(err.message || 'Failed to close conversation.');
      } else {
        setCloseError('Failed to close conversation.');
      }
    }
  };

  const conversation = data?.conversation;

  useEffect(() => {
    if (!conversation) return;
    if (!ticketModalOpen) {
      const customerName = getCustomerDisplayName(conversation.customer);
      setTicketTitle(`Support: ${customerName}`);
      setTicketPriority('MED');
      setTicketError(null);
      setCreatedTicketId(null);
    }
  }, [conversation, ticketModalOpen]);

  const handleCreateTicket = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !conversation) return;

    setTicketError(null);
    try {
      const result = await createTicketMutation.mutateAsync({
        conversationId: id,
        title: ticketTitle,
        priority: ticketPriority,
      });
      const ticketId =
        (result as any)?.ticket?.id ?? (result as any)?.id ?? null;
      if (ticketId) {
        setCreatedTicketId(ticketId);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setTicketError(err.message || 'Failed to create ticket.');
      } else {
        setTicketError('Failed to create ticket.');
      }
    }
  };

  const handleGoToTicket = () => {
    if (createdTicketId) {
      navigate(`/app/tickets/${createdTicketId}`);
    }
  };

  const handleAssign = async (agentId: string | null) => {
    if (!id) return;
    try {
      await assignMutation.mutateAsync({
        conversationId: id,
        agentId,
      });
    } catch (err) {
      // Error handling via refetch
    }
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
      <div className="flex flex-col h-full gap-4">
      {conversation?.needsAttention && (
        <div
          data-testid="conversation-attention-banner"
          className="rounded-md bg-orange-900/30 border border-orange-800 px-4 py-2 text-sm text-orange-200"
        >
          <span className="font-medium">Customer is waiting</span>
          {conversation.lastCustomerMessageAt && (
            <span className="ml-2 text-orange-300">
              (last message {timeAgo(conversation.lastCustomerMessageAt)})
            </span>
          )}
        </div>
      )}
      {closeError && (
        <div className="rounded-md border border-red-800 bg-red-950/50 px-3 py-2 text-xs text-red-300">
          {closeError}
        </div>
      )}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">
            {conversation
              ? getCustomerDisplayName(conversation.customer)
              : 'Conversation'}
          </h1>
          {conversation && (
            <div className="space-y-1">
              <p className="text-xs text-slate-400">
                Inbox: {conversation.inbox.name} • Last message:{' '}
                {timeAgo(conversation.lastMessageAt)}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Assigned to:</span>
                {isAdmin && agentsData ? (
                  <select
                    value={conversation.assignedAgentId || ''}
                    onChange={(e) =>
                      handleAssign(e.target.value === '' ? null : e.target.value)
                    }
                    disabled={assignMutation.isPending}
                    className="text-xs rounded-md border border-slate-800 bg-slate-900 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-60"
                  >
                    <option value="">Unassigned</option>
                    {agentsData.items.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} ({agent.email})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-slate-300">
                    {conversation.assignedAgent
                      ? `${conversation.assignedAgent.name} (${conversation.assignedAgent.email})`
                      : 'Unassigned'}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        {conversation && (
          <div className="flex items-center gap-2">
            {conversation.status === 'OPEN' && !conversation.assignedAgentId && (
              <button
                type="button"
                onClick={handleClaim}
                data-testid="convo-claim"
                disabled={claimMutation.isPending}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 text-slate-100 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {claimMutation.isPending ? 'Claiming...' : 'Claim'}
              </button>
            )}
            {conversation.status === 'OPEN' && (
              <button
                type="button"
                onClick={handleClose}
                data-testid="convo-close"
                disabled={closeMutation.isPending}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 text-slate-100 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {closeMutation.isPending ? 'Closing...' : 'Close'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setTicketModalOpen(true)}
              data-testid="convert-ticket"
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-900 text-slate-100 hover:bg-blue-800"
            >
              Convert to ticket
            </button>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="text-sm text-slate-400">Loading conversation...</div>
      )}
      {error && (
        <div className="text-sm text-red-400">
          {error instanceof Error ? error.message : 'Failed to load conversation.'}
        </div>
      )}

      <div
        data-testid="message-list"
        className="flex-1 min-h-0 overflow-y-auto rounded-md border border-slate-800 bg-slate-950/60 p-3 space-y-2"
      >
        {messages.length === 0 ? (
          <div className="text-sm text-slate-400">No messages yet.</div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${
                m.senderType === 'AGENT' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-xs rounded-lg px-3 py-2 text-sm ${
                  m.senderType === 'AGENT'
                    ? 'bg-slate-200 text-slate-900'
                    : 'bg-slate-800 text-slate-100'
                } ${m.__optimistic ? 'opacity-70' : ''}`}
              >
                <div>{m.body}</div>
                <div className="mt-1 text-[10px] text-slate-500 text-right">
                  {m.__optimistic ? 'Sending…' : timeAgo(m.createdAt)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="space-y-1">
        {customerTyping && (
          <div className="text-xs text-slate-400 mb-1">
            Customer is typing…
          </div>
        )}
        {sendError && (
          <div className="text-xs text-red-400 mb-1">{sendError}</div>
        )}
        <form onSubmit={handleSend} className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            data-testid="message-input"
            rows={2}
            className="flex-1 resize-none rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
            placeholder="Type your reply…"
          />
          <button
            type="submit"
            data-testid="message-send"
            className="px-4 py-2 rounded-md bg-slate-800 text-sm font-medium text-slate-100 hover:bg-slate-700"
          >
            Send
          </button>
        </form>
      </div>

      {ticketModalOpen && conversation && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-950 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Create ticket</h2>
              <button
                type="button"
                onClick={() => setTicketModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleCreateTicket} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs text-slate-400">Title</label>
                <input
                  type="text"
                  value={ticketTitle}
                  onChange={(e) => setTicketTitle(e.target.value)}
                  data-testid="ticket-title-input"
                  className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-slate-400">Priority</label>
                <select
                  value={ticketPriority}
                  onChange={(e) =>
                    setTicketPriority(e.target.value as 'LOW' | 'MED' | 'HIGH')
                  }
                  data-testid="ticket-priority-select"
                  className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
                >
                  <option value="LOW">Low</option>
                  <option value="MED">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
              {ticketError && (
                <div className="text-xs text-red-400">{ticketError}</div>
              )}
              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="submit"
                  data-testid="ticket-create-submit"
                  disabled={createTicketMutation.isPending}
                  className="px-3 py-1.5 rounded-md bg-blue-900 text-xs font-medium text-slate-100 hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {createTicketMutation.isPending ? 'Creating…' : 'Create ticket'}
                </button>
                {createdTicketId && (
                  <button
                    type="button"
                    onClick={handleGoToTicket}
                    className="px-3 py-1.5 rounded-md bg-slate-800 text-xs font-medium text-slate-100 hover:bg-slate-700"
                  >
                    View ticket
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

