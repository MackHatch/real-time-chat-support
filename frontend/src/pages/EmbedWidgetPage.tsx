import { useEffect, useMemo, useState, useRef } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createCustomerSocket } from '../lib/socket';
import type { Message } from '../lib/types';
import { useWidgetSession } from '../features/widget/session';
import { MessageBubble } from '../components/chat/MessageBubble';

type UiMessage = Message & { __optimistic?: boolean };

interface WidgetContext {
  pageUrl?: string;
  referrer?: string;
}

export function EmbedWidgetPage() {
  const [searchParams] = useSearchParams();
  const inboxId = searchParams.get('inboxId') || undefined;
  const [context, setContext] = useState<WidgetContext>({});
  const [isOpen, setIsOpen] = useState(false);
  const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get context from parent window
  useEffect(() => {
    const isInIframe = window.parent !== window;
    
    // If not in iframe, show by default (for direct access/testing)
    if (!isInIframe) {
      setIsOpen(true);
    }

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'WIDGET_SET_CONTEXT') {
        setContext(e.data.context || {});
      } else if (e.data?.type === 'WIDGET_SET_OPEN') {
        setIsOpen(e.data.open === true);
      }
    };

    window.addEventListener('message', handleMessage);

    // Notify parent that we're ready
    if (isInIframe) {
      window.parent.postMessage({ type: 'WIDGET_READY' }, '*');
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Use context or fallback to window location
  const pageUrl = context.pageUrl || window.location.href;
  const referrer = context.referrer || document.referrer || undefined;
  const userAgent = navigator.userAgent;

  const { data, isLoading, error } = useWidgetSession({
    inboxId,
    pageUrl,
    referrer,
    userAgent,
  });

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

  // Notify parent of resize
  const notifyResize = () => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }

    resizeTimeoutRef.current = setTimeout(() => {
      if (window.parent && window.parent !== window) {
        const height = document.body.scrollHeight;
        window.parent.postMessage({ type: 'WIDGET_RESIZE', height }, '*');
      }
    }, 100);
  };

  useEffect(() => {
    notifyResize();
    const observer = new ResizeObserver(notifyResize);
    observer.observe(document.body);

    return () => {
      observer.disconnect();
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [messages, isLoading, error]);

  const handleSend = (e: FormEvent) => {
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
        return;
      }
      if (ack?.message) {
        setMessages((prev: UiMessage[]) => {
          const withoutOptimistic = prev.filter((m) => m.id !== optimistic.id);
          const exists = withoutOptimistic.some((m) => m.id === ack.message.id);
          if (exists) return withoutOptimistic;
          return [...withoutOptimistic, ack.message];
        });
      }
    });
  };

  // If not in iframe, always show (for direct access/testing)
  const isInIframe = window.parent !== window;
  if (isInIframe && !isOpen) {
    return null; // Hide when closed in iframe
  }

  return (
    <div
      data-testid="embed-widget-root"
      className="flex flex-col h-full bg-slate-950 text-slate-100"
      style={{ minHeight: '400px' }}
    >
      <header className="px-4 py-2 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold">Support</h1>
          <p className="text-[10px] text-slate-400 mt-0.5">We're here to help</p>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0">
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
              data-testid="embed-widget-message-list"
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
                  data-testid="embed-widget-message-input"
                  rows={2}
                  className="flex-1 resize-none rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-500"
                  placeholder="Type your message…"
                />
                <button
                  type="submit"
                  data-testid="embed-widget-send"
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
  );
}
