import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Socket } from 'socket.io-client';
import { useParams } from 'react-router-dom';

const INVALIDATION_DEBOUNCE_MS = 750;

export function useRealtimeInvalidation(socket: Socket | null) {
  const queryClient = useQueryClient();
  const params = useParams();
  const currentConversationId = params.id;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!socket) return;

    const scheduleInvalidation = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.invalidateQueries({ queryKey: ['conversation'] });
        timeoutRef.current = null;
      }, INVALIDATION_DEBOUNCE_MS);
    };

    const handleNotification = (payload: {
      type: string;
      payload?: { conversationId?: string };
    }) => {
      scheduleInvalidation();
      // If viewing the conversation that was updated, invalidate it specifically
      if (
        payload.payload?.conversationId &&
        payload.payload.conversationId === currentConversationId
      ) {
        queryClient.invalidateQueries({
          queryKey: ['conversation', currentConversationId],
        });
      }
    };

    socket.on('message.created', scheduleInvalidation);
    socket.on('conversation.updated', scheduleInvalidation);
    socket.on('notification', handleNotification);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      socket.off('message.created', scheduleInvalidation);
      socket.off('conversation.updated', scheduleInvalidation);
      socket.off('notification', handleNotification);
    };
  }, [socket, queryClient, currentConversationId]);
}
