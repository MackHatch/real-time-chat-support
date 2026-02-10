import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';

export type AnalyticsRange = '7d' | '30d' | '90d';

export type AnalyticsSummary = {
  range: AnalyticsRange;
  kpis: {
    openConversations: number;
    needsAttention: number;
    ticketsCreated: number;
    ticketsResolved: number;
    avgFirstResponseSeconds: number | null;
    avgResolutionSeconds: number | null;
  };
  series: {
    days: string[];
    conversationsCreated: number[];
    ticketsCreated: number[];
    ticketsResolved: number[];
  };
};

export function useAnalyticsSummary(
  range: AnalyticsRange,
  token: string | null,
) {
  return useQuery({
    queryKey: ['analytics', 'summary', range],
    queryFn: () =>
      apiFetch<AnalyticsSummary>(`/analytics/summary?range=${range}`, {}, {
        token,
      }),
    enabled: Boolean(token),
  });
}

