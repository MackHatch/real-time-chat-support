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
   * Computes if a conversation needs attention.
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

  async list(userId: string, query: ConversationListQueryDto) {
    const { page, pageSize, skip, take } = this.normalizePagination(query);

    const where: Prisma.ConversationWhereInput = {
      ...(query.status ? { status: query.status as ConversationStatus } : {}),
      ...(query.inboxId ? { inboxId: query.inboxId } : {}),
      ...this.buildAssignedFilter(query.assigned as AssignedFilter | undefined, userId),
    };

    // For needsAttention filter, we need to fetch more items and filter in memory
    // because Prisma can't easily compare two columns in a where clause
    const fetchSize = query.needsAttention === true ? take * 3 : take;
    const fetchSkip = query.needsAttention === true ? 0 : skip;

    const rawItems = await this.prisma.conversation.findMany({
      where,
      select: {
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
      },
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
      skip: fetchSkip,
      take: fetchSize,
    });

    // Compute needsAttention for each item and filter if needed
    const itemsWithAttention = rawItems.map((item) => ({
      ...item,
      needsAttention: this.computeNeedsAttention(
        item.lastCustomerMessageAt,
        item.lastAgentMessageAt,
      ),
    }));

    // Filter by needsAttention if requested
    let filteredItems = itemsWithAttention;
    if (query.needsAttention === true) {
      filteredItems = itemsWithAttention.filter((item) => item.needsAttention);
    } else if (query.needsAttention === false) {
      filteredItems = itemsWithAttention.filter((item) => !item.needsAttention);
    }

    // Sort: needsAttention first, then by lastCustomerMessageAt, then lastMessageAt
    filteredItems.sort((a, b) => {
      // First sort by needsAttention (true first)
      if (a.needsAttention !== b.needsAttention) {
        return a.needsAttention ? -1 : 1;
      }
      // Then by lastCustomerMessageAt (newer first, nulls last)
      if (a.lastCustomerMessageAt && b.lastCustomerMessageAt) {
        const diff =
          b.lastCustomerMessageAt.getTime() - a.lastCustomerMessageAt.getTime();
        if (diff !== 0) return diff;
      } else if (a.lastCustomerMessageAt) {
        return -1;
      } else if (b.lastCustomerMessageAt) {
        return 1;
      }
      // Finally by lastMessageAt (newer first, nulls last)
      if (a.lastMessageAt && b.lastMessageAt) {
        return b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
      } else if (a.lastMessageAt) {
        return -1;
      } else if (b.lastMessageAt) {
        return 1;
      }
      return 0;
    });

    // Apply pagination after filtering
    const paginatedItems = filteredItems.slice(skip, skip + take);

    // For total count, we need to count all matching items
    // If needsAttention filter is applied, we need to count filtered items
    // For simplicity, we'll count all and then filter (acceptable for MVP)
    const allItems = await this.prisma.conversation.findMany({
      where,
      select: {
        lastCustomerMessageAt: true,
        lastAgentMessageAt: true,
      },
    });

    let total = allItems.length;
    if (query.needsAttention === true || query.needsAttention === false) {
      total = allItems.filter((item) => {
        const needsAttention = this.computeNeedsAttention(
          item.lastCustomerMessageAt,
          item.lastAgentMessageAt,
        );
        return query.needsAttention === true ? needsAttention : !needsAttention;
      }).length;
    }

    return {
      items: paginatedItems,
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
      const convo = await tx.conversation.findUnique({
        where: { id: conversationId },
        select: {
          id: true,
          status: true,
          assignedAgentId: true,
        },
      });

      if (!convo) {
        notFound('CONVERSATION_NOT_FOUND', 'Conversation not found.');
      }

      if (convo.status === ConversationStatus.CLOSED) {
        conflict('CONVERSATION_CLOSED', 'Conversation is already closed.');
      }

      if (convo.assignedAgentId) {
        conflict(
          'CONVERSATION_ALREADY_ASSIGNED',
          'Conversation is already assigned.',
        );
      }

      const now = new Date();
      const updated = await tx.conversation.update({
        where: { id: conversationId },
        data: {
          assignedAgentId: userId,
          assignedAt: now,
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
          type: 'conversation.claimed',
          conversationId: updated.id,
          actorUserId: userId,
          metadata: {
            previousAssignedAgentId: null,
            newAssignedAgentId: userId,
          },
        },
      });

      return updated;
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

