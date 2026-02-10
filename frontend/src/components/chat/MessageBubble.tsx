import type { Message } from '../../lib/types';
import { timeAgo } from '../../lib/time';

export type MessageBubbleProps = {
  message: Message & { __optimistic?: boolean };
  isOwn: boolean;
};

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-xs rounded-lg px-3 py-2 text-sm ${
          isOwn ? 'bg-slate-200 text-slate-900' : 'bg-slate-800 text-slate-100'
        } ${message.__optimistic ? 'opacity-70' : ''}`}
      >
        <div>{message.body}</div>
        <div className="mt-1 text-[10px] text-slate-500 text-right">
          {message.__optimistic ? 'Sending…' : timeAgo(message.createdAt)}
        </div>
      </div>
    </div>
  );
}
