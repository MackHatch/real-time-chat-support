import { Injectable } from '@nestjs/common';
import {
  ConversationStatus,
  MessageSenderType,
  TicketStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AnalyticsRange } from './analytics.dto';

type SummaryKpis = {
  openConversations: number;
  needsAttention: number;
  ticketsCreated: number;
  ticketsResolved: number;
  avgFirstResponseSeconds: number | null;
  avgResolutionSeconds: number | null;
};

type SummarySeries = {
  days: string[];
  conversationsCreated: number[];
  ticketsCreated: number[];
  ticketsResolved: number[];
};

type SummaryResponse = {
  range: AnalyticsRange;
  kpis: SummaryKpis;
  series: SummarySeries;
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveRange(range?: AnalyticsRange): {
    range: AnalyticsRange;
    days: number;
    rangeStart: Date;
  } {
    const effectiveRange: AnalyticsRange = range ?? '7d';
    const days =
      effectiveRange === '30d' ? 30 : effectiveRange === '90d' ? 90 : 7;

    const now = new Date();
    const rangeStart = new Date(now);
    rangeStart.setDate(rangeStart.getDate() - (days - 1));
    rangeStart.setHours(0, 0, 0, 0);

    return { range: effectiveRange, days, rangeStart };
  }

  private formatDay(date: Date): string {
    return date.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  private computeNeedsAttention(
    lastCustomerMessageAt: Date | null,
    lastAgentMessageAt: Date | null,
  ): boolean {
    if (!lastCustomerMessageAt) return false;
    if (!lastAgentMessageAt) return true;
    return lastAgentMessageAt < lastCustomerMessageAt;
  }

  async getSummary(range?: AnalyticsRange): Promise<SummaryResponse> {
    const { range: resolvedRange, days, rangeStart } = this.resolveRange(range);

    // Precompute day buckets
    const daysLabels: string[] = [];
    const conversationsCreated = Array<number>(days).fill(0);
    const ticketsCreated = Array<number>(days).fill(0);
    const ticketsResolved = Array<number>(days).fill(0);

    const dayAtIndex = (index: number): Date => {
      const d = new Date(rangeStart);
      d.setDate(rangeStart.getDate() + index);
      return d;
    };

    for (let i = 0; i < days; i++) {
      daysLabels.push(this.formatDay(dayAtIndex(i)));
    }

    const dayIndexFor = (date: Date): number | null => {
      const diffMs = date.getTime() - rangeStart.getTime();
      if (diffMs < 0) return null;
      const idx = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      if (idx < 0 || idx >= days) return null;
      return idx;
    };

    // Open conversations snapshot
    const openConversationsPromise = this.prisma.conversation.count({
      where: { status: ConversationStatus.OPEN },
    });

    const openConversationsForAttentionPromise =
      this.prisma.conversation.findMany({
        where: { status: ConversationStatus.OPEN },
        select: {
          lastCustomerMessageAt: true,
          lastAgentMessageAt: true,
        },
      });

    // Conversations created in range (for volume + first response)
    const conversationsInRangePromise = this.prisma.conversation.findMany({
      where: {
        createdAt: {
          gte: rangeStart,
        },
      },
      select: {
        id: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 2000,
    });

    // Tickets in range (for throughput + resolution + volume)
    const ticketsInRangePromise = this.prisma.ticket.findMany({
      where: {
        createdAt: {
          gte: rangeStart,
        },
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        status: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 3000,
    });

    const [
      openConversations,
      openForAttention,
      conversationsInRange,
      ticketsInRange,
    ] = await Promise.all([
      openConversationsPromise,
      openConversationsForAttentionPromise,
      conversationsInRangePromise,
      ticketsInRangePromise,
    ]);

    const needsAttentionCount = openForAttention.filter((c) =>
      this.computeNeedsAttention(
        c.lastCustomerMessageAt,
        c.lastAgentMessageAt,
      ),
    ).length;

    // Volume: conversations created per day
    for (const convo of conversationsInRange) {
      const idx = dayIndexFor(convo.createdAt);
      if (idx != null) {
        conversationsCreated[idx] += 1;
      }
    }

    // Tickets throughput + resolution stats
    const resolvedTickets = ticketsInRange.filter(
      (t) => t.status === TicketStatus.RESOLVED,
    );

    for (const ticket of ticketsInRange) {
      const createdIdx = dayIndexFor(ticket.createdAt);
      if (createdIdx != null) {
        ticketsCreated[createdIdx] += 1;
      }
      if (ticket.status === TicketStatus.RESOLVED) {
        const resolvedIdx = dayIndexFor(ticket.updatedAt);
        if (resolvedIdx != null) {
          ticketsResolved[resolvedIdx] += 1;
        }
      }
    }

    const ticketsCreatedCount = ticketsInRange.length;
    const ticketsResolvedCount = resolvedTickets.length;

    let avgResolutionSeconds: number | null = null;
    if (resolvedTickets.length > 0) {
      const totalResolutionSeconds = resolvedTickets.reduce((sum, t) => {
        const diff = (t.updatedAt.getTime() - t.createdAt.getTime()) / 1000;
        return sum + Math.max(diff, 0);
      }, 0);
      avgResolutionSeconds = totalResolutionSeconds / resolvedTickets.length;
    }

    // First response time: per conversation
    let avgFirstResponseSeconds: number | null = null;
    if (conversationsInRange.length > 0) {
      const conversationIds = conversationsInRange.map((c) => c.id);

      const messages = await this.prisma.message.findMany({
        where: {
          conversationId: { in: conversationIds },
          senderType: {
            in: [MessageSenderType.CUSTOMER, MessageSenderType.AGENT],
          },
        },
        select: {
          conversationId: true,
          senderType: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      const firstResponseSeconds: number[] = [];
      const byConversation = new Map<
        string,
        { firstCustomer?: Date; firstAgentAfterCustomer?: Date }
      >();

      for (const convo of conversationsInRange) {
        byConversation.set(convo.id, {});
      }

      for (const message of messages) {
        const entry = byConversation.get(message.conversationId);
        if (!entry) continue;

        if (
          message.senderType === MessageSenderType.CUSTOMER &&
          !entry.firstCustomer
        ) {
          entry.firstCustomer = message.createdAt;
        } else if (
          message.senderType === MessageSenderType.AGENT &&
          entry.firstCustomer &&
          !entry.firstAgentAfterCustomer &&
          message.createdAt > entry.firstCustomer
        ) {
          entry.firstAgentAfterCustomer = message.createdAt;
        }
      }

      for (const entry of byConversation.values()) {
        if (entry.firstCustomer && entry.firstAgentAfterCustomer) {
          const diffSeconds =
            (entry.firstAgentAfterCustomer.getTime() -
              entry.firstCustomer.getTime()) /
            1000;
          if (diffSeconds >= 0) {
            firstResponseSeconds.push(diffSeconds);
          }
        }
      }

      if (firstResponseSeconds.length > 0) {
        const total = firstResponseSeconds.reduce((sum, s) => sum + s, 0);
        avgFirstResponseSeconds = total / firstResponseSeconds.length;
      }
    }

    const summary: SummaryResponse = {
      range: resolvedRange,
      kpis: {
        openConversations,
        needsAttention: needsAttentionCount,
        ticketsCreated: ticketsCreatedCount,
        ticketsResolved: ticketsResolvedCount,
        avgFirstResponseSeconds,
        avgResolutionSeconds,
      },
      series: {
        days: daysLabels,
        conversationsCreated,
        ticketsCreated,
        ticketsResolved,
      },
    };

    return summary;
  }

  async getTicketsCsv(range?: AnalyticsRange): Promise<string> {
    const { rangeStart } = this.resolveRange(range);

    const tickets = await this.prisma.ticket.findMany({
      where: {
        createdAt: {
          gte: rangeStart,
        },
      },
      include: {
        assignedAgent: {
          select: {
            email: true,
          },
        },
        conversation: {
          select: {
            id: true,
            customer: {
              select: {
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 5000,
    });

    const header = [
      'id',
      'title',
      'status',
      'priority',
      'assignedAgentEmail',
      'createdAt',
      'updatedAt',
      'conversationId',
      'customerEmail',
    ];

    const escape = (value: string | null | undefined): string => {
      if (value == null) return '';
      const str = String(value);
      if (str.includes('"') || str.includes(',') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines: string[] = [];
    lines.push(header.join(','));

    for (const t of tickets) {
      const row = [
        escape(t.id),
        escape(t.title),
        escape(t.status),
        escape(t.priority),
        escape(t.assignedAgent?.email ?? ''),
        escape(t.createdAt.toISOString()),
        escape(t.updatedAt.toISOString()),
        escape(t.conversation?.id ?? ''),
        escape(t.conversation?.customer?.email ?? ''),
      ];
      lines.push(row.join(','));
    }

    return lines.join('\n');
  }
}

