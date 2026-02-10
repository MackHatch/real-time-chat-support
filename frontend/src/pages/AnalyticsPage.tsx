import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useAnalyticsSummary, AnalyticsRange } from '../features/analytics/queries';
import { VolumeChart } from '../components/analytics/VolumeChart';
import { buildUrl } from '../lib/api';

function formatSeconds(seconds: number | null): string {
  if (seconds == null) return 'N/A';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

export function AnalyticsPage() {
  const { token } = useAuth();
  const [range, setRange] = useState<AnalyticsRange>('7d');

  const { data, isLoading, error } = useAnalyticsSummary(range, token);

  const handleExport = async () => {
    if (!token) return;
    try {
      const url = buildUrl(`/analytics/tickets.csv?range=${range}`);
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        // eslint-disable-next-line no-alert
        alert('Failed to export CSV.');
        return;
      }
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `tickets-${range}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert('Failed to export CSV.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">Analytics</h1>
        <div className="flex items-center gap-3">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as AnalyticsRange)}
            data-testid="analytics-range"
            className="text-sm rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <button
            type="button"
            onClick={handleExport}
            data-testid="analytics-export"
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 text-slate-100 hover:bg-slate-700"
          >
            Export tickets CSV
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="text-sm text-slate-400">Loading analytics…</div>
      )}

      {error && (
        <div className="rounded-md bg-red-900/20 border border-red-800 px-3 py-2 text-sm text-red-400">
          {error instanceof Error ? error.message : 'Failed to load analytics.'}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-md border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-xs uppercase text-slate-400 mb-1">
                Open conversations
              </div>
              <div className="text-2xl font-semibold text-slate-100">
                {data.kpis.openConversations}
              </div>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-xs uppercase text-slate-400 mb-1">
                Needs attention
              </div>
              <div className="text-2xl font-semibold text-orange-300">
                {data.kpis.needsAttention}
              </div>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-xs uppercase text-slate-400 mb-1">
                Tickets created
              </div>
              <div className="text-2xl font-semibold text-slate-100">
                {data.kpis.ticketsCreated}
              </div>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-xs uppercase text-slate-400 mb-1">
                Tickets resolved
              </div>
              <div className="text-2xl font-semibold text-green-300">
                {data.kpis.ticketsResolved}
              </div>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-xs uppercase text-slate-400 mb-1">
                Avg first response
              </div>
              <div className="text-lg font-semibold text-slate-100">
                {formatSeconds(data.kpis.avgFirstResponseSeconds)}
              </div>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-xs uppercase text-slate-400 mb-1">
                Avg resolution time
              </div>
              <div className="text-lg font-semibold text-slate-100">
                {formatSeconds(data.kpis.avgResolutionSeconds)}
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-200 mb-2">
              Volume over time
            </h2>
            <VolumeChart
              days={data.series.days}
              conversationsCreated={data.series.conversationsCreated}
              ticketsCreated={data.series.ticketsCreated}
              ticketsResolved={data.series.ticketsResolved}
            />
          </div>
        </>
      )}
    </div>
  );
}

