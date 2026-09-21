import { Injectable } from '@nestjs/common';
import { ConversationStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConversationListQueryDto,
  AssignedFilter,
  AssignConversationDto,
} from './conversations.dto';
import { conflict, forbidden, notFound } from '../common/http-errors';
import { AgentChatGateway } from '../realtime/chat.gateway';
import { claimConversationAtomic } from './claim-conversation';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: AgentChatGateway,
  ) {}

  private normalizePagination(query: ConversationListQueryDto) {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const rawPageSize = Number(query.pageSize ?? 20) || 20;
    const pageSize = Math.min(Math.max(1, rawPageSize), 100);
    const skip = (page - 1) * pageSize;
    const take = pageSize;
    return { page, pageSize, skip, take };
  }

  private buildAssignedFilter(
    assigned: AssignedFilter | undefined,
    userId: string,
  ): Prisma.ConversationWhereInput {
    if (!assigned || assigned === 'all') {
      return {};
    }
    if (assigned === 'me') {
      return { assignedAgentId: userId };
    }
    if (assigned === 'unassigned') {
      return { assignedAgentId: null };
    }
    return {};
  }

  /**
   * needsAttention = lastCustomerMessageAt != null AND (
   *   lastAgentMessageAt == null OR lastAgentMessageAt < lastCustomerMessageAt
   * )
   */
  private computeNeedsAttention(
    lastCustomerMessageAt: Date | null,
    lastAgentMessageAt: Date | null,
  ): boolean {
    if (!lastCustomerMessageAt) {
      return false;
    }
    if (!lastAgentMessageAt) {
      return true; // Customer has messaged but agent never replied
    }
    return lastAgentMessageAt < lastCustomerMessageAt; // Customer's last message is newer
  }

  private buildListWhere(
    userId: string,
    query: ConversationListQueryDto,
  ): Prisma.ConversationWhereInput {
    return {
      ...(query.status ? { status: query.status as ConversationStatus } : {}),
      ...(query.inboxId ? { inboxId: query.inboxId } : {}),
      ...this.buildAssignedFilter(
        query.assigned as AssignedFilter | undefined,
        userId,
      ),
    };
  }

  /**
   * SQL predicate for the needs-attention column comparison.
   * Kept in the database so filtered pagination (skip/take + total) stays correct.
   */
  private needsAttentionSql(needsAttention: boolean): Prisma.Sql {
    if (needsAttention) {
      return Prisma.sql`(
        "lastCustomerMessageAt" IS NOT NULL
        AND (
          "lastAgentMessageAt" IS NULL
          OR "lastAgentMessageAt" < "lastCustomerMessageAt"
        )
      )`;
    }

    return Prisma.sql`(
      "lastCustomerMessageAt" IS NULL
      OR (
        "lastAgentMessageAt" IS NOT NULL
        AND "lastAgentMessageAt" >= "lastCustomerMessageAt"
      )
    )`;
  }

  private buildListSqlWhere(
    userId: string,
    query: ConversationListQueryDto,
  ): Prisma.Sql {
    const conditions: Prisma.Sql[] = [];

    if (query.status) {
      conditions.push(
        Prisma.sql`"status" = CAST(${query.status} AS "ConversationStatus")`,
      );
    }
    if (query.inboxId) {
      conditions.push(Prisma.sql`"inboxId" = ${query.inboxId}`);
    }

    const assigned = query.assigned as AssignedFilter | undefined;
    if (assigned === 'me') {
      conditions.push(Prisma.sql`"assignedAgentId" = ${userId}`);
    } else if (assigned === 'unassigned') {
      conditions.push(Prisma.sql`"assignedAgentId" IS NULL`);
    }

    if (query.needsAttention === true || query.needsAttention === false) {
      conditions.push(this.needsAttentionSql(query.needsAttention));
    }

    if (conditions.length === 0) {
      return Prisma.sql``;
    }

    return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
  }

  private readonly listSelect = {
    id: true,
    status: true,
    assignedAgentId: true,
    lastMessageAt: true,
    lastCustomerMessageAt: true,
    lastAgentMessageAt: true,
    createdAt: true,
    updatedAt: true,
    customer: {
      select: {
        id: true,
        name: true,
        email: true,
        externalId: true,
      },
    },
    inbox: {
      select: {
        id: true,
        name: true,
      },
    },
    ticket: {
      select: {
        id: true,
        status: true,
        priority: true,
      },
    },
    assignedAgent: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
  } satisfies Prisma.ConversationSelect;

  async list(userId: string, query: ConversationListQueryDto) {
    const { page, pageSize, skip, take } = this.normalizePagination(query);
    const where = this.buildListWhere(userId, query);
    const filterNeedsAttention =
      query.needsAttention === true || query.needsAttention === false;

    // When filtering by needsAttention, compare columns in SQL so later pages
    // and totals stay correct (the old in-memory pageSize*3 approach did not).
    if (filterNeedsAttention) {
      const sqlWhere = this.buildListSqlWhere(userId, query);

      const [idRows, countRows] = await Promise.all([
        this.prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM "Conversation"
          ${sqlWhere}
          ORDER BY
            "lastCustomerMessageAt" DESC NULLS LAST,
            "lastMessageAt" DESC NULLS LAST
          LIMIT ${take} OFFSET ${skip}
        `,
        this.prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count
          FROM "Conversation"
          ${sqlWhere}
        `,
      ]);

      const ids = idRows.map((row) => row.id);
      const total = Number(countRows[0]?.count ?? 0n);

      if (ids.length === 0) {
        return { items: [], page, pageSize, total };
      }

      const rawItems = await this.prisma.conversation.findMany({
        where: { id: { in: ids } },
        select: this.listSelect,
      });

      const byId = new Map(rawItems.map((item) => [item.id, item]));
      const items = ids
        .map((id) => byId.get(id))
        .filter((item): item is NonNullable<typeof item> => item != null)
        .map((item) => ({
          ...item,
          needsAttention: this.computeNeedsAttention(
            item.lastCustomerMessageAt,
            item.lastAgentMessageAt,
          ),
        }));

      return { items, page, pageSize, total };
    }

    const [rawItems, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        select: this.listSelect,
        orderBy: [
          {
            lastCustomerMessageAt: {
              sort: 'desc',
              nulls: 'last',
            },
          },
          {
            lastMessageAt: {
              sort: 'desc',
              nulls: 'last',
            },
          },
        ],
        skip,
        take,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    // Default inbox: annotate attention and prefer needing-attention rows on this page.
    // Cross-page global ordering by needsAttention would need a derived column/index.
    const items = rawItems
      .map((item) => ({
        ...item,
        needsAttention: this.computeNeedsAttention(
          item.lastCustomerMessageAt,
          item.lastAgentMessageAt,
        ),
      }))
      .sort((a, b) => {
        if (a.needsAttention !== b.needsAttention) {
          return a.needsAttention ? -1 : 1;
        }
        if (a.lastCustomerMessageAt && b.lastCustomerMessageAt) {
          const diff =
            b.lastCustomerMessageAt.getTime() -
            a.lastCustomerMessageAt.getTime();
          if (diff !== 0) return diff;
        } else if (a.lastCustomerMessageAt) {
          return -1;
        } else if (b.lastCustomerMessageAt) {
          return 1;
        }
        if (a.lastMessageAt && b.lastMessageAt) {
          return b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
        } else if (a.lastMessageAt) {
          return -1;
        } else if (b.lastMessageAt) {
          return 1;
        }
        return 0;
      });

    return {
      items,
      page,
      pageSize,
      total,
    };
  }

  async getDetail(_userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            externalId: true,
          },
        },
        inbox: {
          select: {
            id: true,
            name: true,
          },
        },
        assignedAgent: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        ticket: {
          select: {
            id: true,
            status: true,
            priority: true,
            title: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 50,
        },
      },
    });

    if (!conversation) {
      notFound('CONVERSATION_NOT_FOUND', 'Conversation not found.');
    }

    const messagesAsc = [...conversation.messages].sort((a, b) =>
      a.createdAt.getTime() - b.createdAt.getTime(),
    );

    const needsAttention = this.computeNeedsAttention(
      conversation.lastCustomerMessageAt,
      conversation.lastAgentMessageAt,
    );

    return {
      conversation: {
        ...conversation,
        needsAttention,
        messages: undefined, // Remove messages from conversation object
      },
      messages: messagesAsc,
    };
  }

  async claim(userId: string, conversationId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const claim = await claimConversationAtomic(tx, userId, conversationId);

      if (!claim.ok) {
        switch (claim.reason) {
          case 'NOT_FOUND':
            notFound('CONVERSATION_NOT_FOUND', 'Conversation not found.');
          case 'CLOSED':
            conflict('CONVERSATION_CLOSED', 'Conversation is already closed.');
          case 'ALREADY_ASSIGNED':
            conflict(
              'CONVERSATION_ALREADY_ASSIGNED',
              'Conversation is already assigned.',
            );
          default:
            conflict(
              'CONVERSATION_CLAIM_FAILED',
              'Failed to claim conversation.',
            );
        }
      }

      return claim.conversation;
    });

    return result;
  }

  async close(userId: string, conversationId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const convo = await tx.conversation.findUnique({
        where: { id: conversationId },
        select: {
          id: true,
          status: true,
        },
      });

      if (!convo) {
        notFound('CONVERSATION_NOT_FOUND', 'Conversation not found.');
      }

      if (convo.status === ConversationStatus.CLOSED) {
        // idempotent: still create an event for auditing
        await tx.eventLog.create({
          data: {
            type: 'conversation.closed',
            conversationId: convo.id,
            actorUserId: userId,
            metadata: {
              alreadyClosed: true,
            },
          },
        });

        const existing = await tx.conversation.findUnique({
          where: { id: conversationId },
          include: {
            customer: true,
            inbox: true,
            assignedAgent: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            ticket: {
              select: {
                id: true,
                status: true,
                priority: true,
              },
            },
          },
        });

        if (!existing) {
          notFound('CONVERSATION_NOT_FOUND', 'Conversation not found.');
        }

        return existing;
      }

      const updated = await tx.conversation.update({
        where: { id: conversationId },
        data: {
          status: ConversationStatus.CLOSED,
        },
        include: {
          customer: true,
          inbox: true,
          assignedAgent: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          ticket: {
            select: {
              id: true,
              status: true,
              priority: true,
            },
          },
        },
      });

      await tx.eventLog.create({
        data: {
          type: 'conversation.closed',
          conversationId: updated.id,
          actorUserId: userId,
          metadata: {
            by: userId,
          },
        },
      });

      return updated;
    });

    return result;
  }

  async assign(
    userId: string,
    userRole: UserRole,
    conversationId: string,
    dto: AssignConversationDto,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      // Load current user to verify role
      const currentUser = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      });

      if (!currentUser) {
        forbidden('USER_NOT_FOUND', 'Current user not found.');
      }

      const actualRole = currentUser.role;

      // Authorization check
      const targetAgentId = dto.agentId ?? null;

      if (actualRole !== UserRole.ADMIN) {
        // AGENT can only self-assign
        if (targetAgentId !== null && targetAgentId !== userId) {
          forbidden(
            'FORBIDDEN_ASSIGNMENT',
            'Agents can only assign conversations to themselves.',
          );
        }
        // If agentId is omitted, treat as self-assign
        if (targetAgentId === null && dto.agentId === undefined) {
          // This is unassign - agents cannot unassign
          forbidden(
            'FORBIDDEN_UNASSIGN',
            'Agents cannot unassign conversations.',
          );
        }
      }

      // Validate target agent exists and is AGENT/ADMIN (if not null)
      if (targetAgentId !== null) {
        const targetAgent = await tx.user.findUnique({
          where: { id: targetAgentId },
          select: { id: true, role: true },
        });

        if (!targetAgent) {
          notFound('AGENT_NOT_FOUND', 'Target agent not found.');
        }

        if (
          targetAgent.role !== UserRole.AGENT &&
          targetAgent.role !== UserRole.ADMIN
        ) {
          forbidden(
            'INVALID_AGENT_ROLE',
            'Target user is not an agent or admin.',
          );
        }
      }

      const conversation = await tx.conversation.findUnique({
        where: { id: conversationId },
        select: {
          id: true,
          status: true,
          assignedAgentId: true,
        },
      });

      if (!conversation) {
        notFound('CONVERSATION_NOT_FOUND', 'Conversation not found.');
      }

      if (conversation.status === ConversationStatus.CLOSED) {
        conflict('CONVERSATION_CLOSED', 'Cannot assign a closed conversation.');
      }

      const previousAssignedAgentId = conversation.assignedAgentId;
      const now = new Date();

      const updated = await tx.conversation.update({
        where: { id: conversationId },
        data: {
          assignedAgentId: targetAgentId,
          assignedAt: targetAgentId ? now : null,
        },
        include: {
          customer: true,
          inbox: true,
          assignedAgent: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          ticket: {
            select: {
              id: true,
              status: true,
              priority: true,
            },
          },
        },
      });

      await tx.eventLog.create({
        data: {
          type: 'conversation.assigned',
          conversationId: updated.id,
          actorUserId: userId,
          metadata: {
            from: previousAssignedAgentId,
            to: targetAgentId,
          },
        },
      });

      return updated;
    });

    // Emit realtime updates
    const room = `conversation:${result.id}`;
    this.chatGateway.server.to(room).emit('conversation.updated', {
      conversation: result,
    });

    if (result.assignedAgentId) {
      this.chatGateway.server
        .to(`agent:${result.assignedAgentId}`)
        .emit('notification', {
          type: 'conversation.assigned',
          payload: {
            conversationId: result.id,
          },
        });
    }

    return result;
  }
}

