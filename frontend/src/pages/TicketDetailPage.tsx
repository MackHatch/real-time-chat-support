import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useTicket, useUpdateTicket } from '../features/tickets/queries';
import { timeAgo } from '../lib/time';
import { ApiError } from '../lib/api';

function getCustomerDisplayName(customer: {
  id: string;
  name?: string | null;
  email?: string | null;
  externalId?: string | null;
}): string {
  return customer.name || customer.email || customer.externalId || customer.id;
}

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();

  const { data, isLoading, error } = useTicket(id, token);
  const updateMutation = useUpdateTicket(id, token);

  const [status, setStatus] = useState<string>('');
  const [priority, setPriority] = useState<'LOW' | 'MED' | 'HIGH'>('MED');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (data) {
      setStatus(data.status);
      setPriority(data.priority);
      setHasChanges(false);
      setSaveError(null);
    }
  }, [data]);

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    setHasChanges(true);
    setSaveError(null);
  };

  const handlePriorityChange = (newPriority: 'LOW' | 'MED' | 'HIGH') => {
    setPriority(newPriority);
    setHasChanges(true);
    setSaveError(null);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !hasChanges) return;

    setSaveError(null);

    try {
      await updateMutation.mutateAsync({
        status: status !== data?.status ? status : undefined,
        priority: priority !== data?.priority ? priority : undefined,
      });
      setHasChanges(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setSaveError(err.message || 'Failed to update ticket.');
      } else {
        setSaveError('Failed to update ticket.');
      }
    }
  };

  const ticket = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            {ticket ? ticket.title : 'Ticket'}
          </h1>
          {ticket && (
            <p className="text-xs text-slate-400 mt-1">
              Created {timeAgo(ticket.createdAt)} • Updated{' '}
              {timeAgo(ticket.updatedAt)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate('/app/tickets')}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 text-slate-100 hover:bg-slate-700"
        >
          Back to list
        </button>
      </div>

      {isLoading && (
        <div className="text-sm text-slate-400">Loading ticket...</div>
      )}

      {error && (
        <div className="rounded-md bg-red-900/20 border border-red-800 px-3 py-2 text-sm text-red-400">
          {error instanceof Error ? error.message : 'Failed to load ticket.'}
        </div>
      )}

      {ticket && (
        <div className="space-y-4">
          <div className="rounded-md border border-slate-800 bg-slate-950/50 p-4 space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Conversation
              </label>
              <Link
                to={`/app/conversations/${ticket.conversationId}`}
                className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
              >
                View conversation →
              </Link>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Customer
              </label>
              <p className="text-sm text-slate-100">
                {getCustomerDisplayName(ticket.conversation.customer)}
              </p>
              {ticket.conversation.customer.email && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {ticket.conversation.customer.email}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Inbox</label>
              <p className="text-sm text-slate-100">
                {ticket.conversation.inbox.name}
              </p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="rounded-md border border-slate-800 bg-slate-950/50 p-4 space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  data-testid="ticket-status-select"
                  className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
                >
                  <option value="NEW">New</option>
                  <option value="OPEN">Open</option>
                  <option value="PENDING">Pending</option>
                  <option value="RESOLVED">Resolved</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) =>
                    handlePriorityChange(e.target.value as 'LOW' | 'MED' | 'HIGH')
                  }
                  data-testid="ticket-priority-select"
                  className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
                >
                  <option value="LOW">Low</option>
                  <option value="MED">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Assignment
                </label>
                <p className="text-sm text-slate-400 italic">
                  Assignment coming next
                </p>
              </div>
            </div>

            {saveError && (
              <div className="rounded-md bg-red-900/20 border border-red-800 px-3 py-2 text-sm text-red-400">
                {saveError}
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                type="submit"
                data-testid="ticket-save"
                disabled={!hasChanges || updateMutation.isPending}
                className="px-4 py-2 rounded-md bg-slate-800 text-sm font-medium text-slate-100 hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save changes'}
              </button>
              {hasChanges && (
                <p className="text-xs text-slate-400">You have unsaved changes</p>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
