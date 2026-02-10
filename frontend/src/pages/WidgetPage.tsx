import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import { createCustomerSocket } from '../lib/socket';
import type { Message } from '../lib/types';
import { useWidgetSession } from '../features/widget/session';
import { MessageBubble } from '../components/chat/MessageBubble';

type UiMessage = Message & { __optimistic?: boolean };

export function WidgetPage() {
  const { data, isLoading, error } = useWidgetSession({});
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);

  const conversationId = data?.conversationId;
  const customerToken = data?.customerToken;

  useEffect(() => {
    if (!data) return;
    const sorted = [...data.messages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    setMessages(sorted);
  }, [data]);

  const socket = useMemo(() => {
    if (!customerToken) return null;
    const s = createCustomerSocket(customerToken);
    if (conversationId) {
      s.emit('conversation.join', { conversationId });
    }
    return s;
  }, [customerToken, conversationId]);

  useEffect(() => {
    if (!socket || !conversationId) return;

    const handleMessageCreated = (payload: { conversationId: string; message: Message }) => {
      if (payload.conversationId !== conversationId) return;

      setMessages((prev: UiMessage[]) => {
        const withoutOptimistic = prev.filter(
          (m: UiMessage) => !(m.__optimistic && m.body === payload.message.body),
        );
        const exists = withoutOptimistic.some((m: UiMessage) => m.id === payload.message.id);
        if (exists) return withoutOptimistic;
        return [...withoutOptimistic, payload.message];
      });
    };

    socket.on('message.created', handleMessageCreated);

    return () => {
      socket.off('message.created', handleMessageCreated);
      socket.disconnect();
    };
  }, [socket, conversationId]);

  const handleSend = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!socket || !conversationId) return;
    const trimmed = input.trim();
    if (!trimmed) return;

    setSendError(null);

    const optimistic: UiMessage = {
      id: `local-${Date.now()}`,
      conversationId,
      senderType: 'CUSTOMER',
      senderUserId: null,
      senderCustomerId: null,
      body: trimmed,
      createdAt: new Date().toISOString(),
      __optimistic: true,
    };

    setMessages((prev: UiMessage[]) => [...prev, optimistic]);
    setInput('');

    socket.emit('message.send', { conversationId, body: trimmed }, (ack: any) => {
      if (ack && ack.error) {
        setSendError(ack.error.message ?? 'Failed to send message.');
        setMessages((prev: UiMessage[]) =>
          prev.filter((m: UiMessage) => m.id !== optimistic.id),
        );
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100 px-3">
      <div className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-950 shadow-lg flex flex-col h-[70vh]">
        <header className="px-4 py-3 border-b border-slate-800">
          <h1 className="text-sm font-semibold">Support chat</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Chat with our support team.
          </p>
        </header>

        <main className="flex-1 flex flex-col">
          {isLoading && (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
              Connecting…
            </div>
          )}

          {error && (
            <div className="flex-1 flex items-center justify-center text-sm text-red-400 px-4">
              {error instanceof Error ? error.message : 'Failed to start chat.'}
            </div>
          )}

          {!isLoading && !error && (
            <>
              <div
                data-testid="widget-message-list"
                className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2"
              >
                {messages.length === 0 ? (
                  <div className="text-xs text-slate-400 text-center mt-4">
                    Say hi to start the conversation.
                  </div>
                ) : (
                  messages.map((m) => (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      isOwn={m.senderType === 'CUSTOMER'}
                    />
                  ))
                )}
              </div>

              <div className="border-t border-slate-800 px-3 py-2">
                {sendError && (
                  <div className="text-[11px] text-red-400 mb-1">{sendError}</div>
                )}
                <form onSubmit={handleSend} className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    data-testid="widget-message-input"
                    rows={2}
                    className="flex-1 resize-none rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-500"
                    placeholder="Type your message…"
                  />
                  <button
                    type="submit"
                    data-testid="widget-send"
                    className="px-3 py-1.5 rounded-md bg-slate-800 text-xs font-medium text-slate-100 hover:bg-slate-700"
                  >
                    Send
                  </button>
                </form>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

