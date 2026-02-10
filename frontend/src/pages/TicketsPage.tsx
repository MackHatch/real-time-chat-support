import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useTicketsList } from '../features/tickets/queries';
import { timeAgo } from '../lib/time';

function getCustomerDisplayName(customer: {
  id: string;
  name?: string | null;
  email?: string | null;
  externalId?: string | null;
}): string {
  return customer.name || customer.email || customer.externalId || customer.id;
}

function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'NEW':
      return 'bg-blue-900/30 text-blue-400';
    case 'OPEN':
      return 'bg-green-900/30 text-green-400';
    case 'PENDING':
      return 'bg-yellow-900/30 text-yellow-400';
    case 'RESOLVED':
      return 'bg-slate-700 text-slate-300';
    default:
      return 'bg-slate-800 text-slate-400';
  }
}

function getPriorityBadgeColor(priority: string): string {
  switch (priority) {
    case 'HIGH':
      return 'bg-red-900/30 text-red-400';
    case 'MED':
      return 'bg-yellow-900/30 text-yellow-400';
    case 'LOW':
      return 'bg-slate-700 text-slate-300';
    default:
      return 'bg-slate-800 text-slate-400';
  }
}

export function TicketsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [assignedFilter, setAssignedFilter] = useState<'me' | 'all'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading, error } = useTicketsList(
    {
      status: statusFilter || undefined,
      assigned: assignedFilter,
      page,
      pageSize,
    },
    token,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Tickets</h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            data-testid="tickets-filter-status"
            className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="">All</option>
            <option value="NEW">New</option>
            <option value="OPEN">Open</option>
            <option value="PENDING">Pending</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Assigned:</label>
          <select
            value={assignedFilter}
            onChange={(e) => {
              setAssignedFilter(e.target.value as 'me' | 'all');
              setPage(1);
            }}
            data-testid="tickets-filter-assigned"
            className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="all">All</option>
            <option value="me">Me</option>
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="text-sm text-slate-400">Loading tickets...</div>
      )}

      {error && (
        <div className="rounded-md bg-red-900/20 border border-red-800 px-3 py-2 text-sm text-red-400">
          {error instanceof Error ? error.message : 'Failed to load tickets.'}
        </div>
      )}

      {data && (
        <>
          <div className="rounded-md border border-slate-800 bg-slate-950/50 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-400">
                    Title
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-400">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-400">
                    Priority
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-400">
                    Customer
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-400">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody data-testid="ticket-list" className="divide-y divide-slate-800">
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                      No tickets found.
                    </td>
                  </tr>
                ) : (
                  data.items.map((ticket) => (
                    <tr
                      key={ticket.id}
                      data-testid={`ticket-item-${ticket.id}`}
                      onClick={() => navigate(`/app/tickets/${ticket.id}`)}
                      className="hover:bg-slate-900/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-slate-100">
                        {ticket.title}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeColor(
                            ticket.status,
                          )}`}
                        >
                          {ticket.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getPriorityBadgeColor(
                            ticket.priority,
                          )}`}
                        >
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {getCustomerDisplayName(ticket.conversation.customer)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {timeAgo(ticket.updatedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
