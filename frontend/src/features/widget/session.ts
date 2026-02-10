import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import type { Message } from '../../lib/types';

const EXTERNAL_ID_KEY = 'widgetExternalId';

export function getOrCreateExternalId(): string {
  if (typeof window === 'undefined') {
    // Fallback for non-browser environments (should not normally run)
    return 'external-' + Math.random().toString(36).slice(2);
  }

  let id = window.localStorage.getItem(EXTERNAL_ID_KEY);
  if (!id) {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      id = crypto.randomUUID();
    } else {
      id = 'ext-' + Math.random().toString(36).slice(2);
    }
    window.localStorage.setItem(EXTERNAL_ID_KEY, id);
  }
  return id;
}

export type WidgetSession = {
  customerId: string;
  conversationId: string;
  customerToken: string;
  messages: Message[];
};

export interface WidgetSessionOptions {
  inboxId?: string;
  pageUrl?: string;
  referrer?: string;
  userAgent?: string;
  name?: string;
  email?: string;
}

export function useWidgetSession(options: WidgetSessionOptions = {}) {
  const externalId = useMemo(() => getOrCreateExternalId(), []);

  return useQuery({
    queryKey: ['widget', 'session', externalId, options.inboxId],
    queryFn: () => {
      const body: Record<string, string | undefined> = {
        externalId,
        inboxId: options.inboxId,
        pageUrl: options.pageUrl,
        referrer: options.referrer,
        userAgent: options.userAgent,
        name: options.name,
        email: options.email,
      };

      // Remove undefined values
      Object.keys(body).forEach((key) => {
        if (body[key] === undefined) {
          delete body[key];
        }
      });

      return apiFetch<WidgetSession>(
        '/widget/session',
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
        {},
      );
    },
  });
}