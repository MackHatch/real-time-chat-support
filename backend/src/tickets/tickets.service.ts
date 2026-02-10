import { Injectable } from '@nestjs/common';
import {
  Prisma,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { badRequest, conflict, notFound } from '../common/http-errors';
import {
  CreateTicketDto,
  TicketListQueryDto,
  UpdateTicketDto,
  TicketAssignedFilter,
} from './tickets.dto';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizePagination(query: TicketListQueryDto) {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const rawPageSize = Number(query.pageSize ?? 20) || 20;
    const pageSize = Math.min(Math.max(1, rawPageSize), 100);
    const skip = (page - 1) * pageSize;
    const take = pageSize;
    return { page, pageSize, skip, take };
  }

  private buildAssignedFilter(
    assigned: TicketAssignedFilter | undefined,
    userId: string,
  ): Prisma.TicketWhereInput {
    if (!assigned || assigned === 'all') {
      return {};
    }
    if (assigned === 'me') {
      return { assignedAgentId: userId };
    }
    return {};
  }

  async create(userId: string, dto: CreateTicketDto) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
      select: {
        id: true,
        assignedAgentId: true,
      },
    });

    if (!conversation) {
      notFound('CONVERSATION_NOT_FOUND', 'Conversation not found.');
    }

    const assigneeId = conversation.assignedAgentId ?? userId;

    try {
      const ticket = await this.prisma.ticket.create({
        data: {
          conversationId: dto.conversationId,
          title: dto.title,
          priority: dto.priority ?? TicketPriority.MED,
          status: TicketStatus.NEW,
          createdByAgentId: userId,
          assignedAgentId: assigneeId,
        },
        include: {
          conversation: {
            select: {
              id: true,
              status: true,
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
            },
          },
        },
      });

      await this.prisma.eventLog.create({
        data: {
          type: 'ticket.created',
          conversationId: dto.conversationId,
          actorUserId: userId,
          metadata: {
            ticketId: ticket.id,
            title: ticket.title,
            priority: ticket.priority,
            assignedAgentId: ticket.assignedAgentId,
          },
        },
      });

      return ticket;
    } catch (e: any) {
      if (e?.code === 'P2002') {
        conflict(
          'TICKET_ALREADY_EXISTS',
          'Ticket already exists for this conversation.',
        );
      }
      throw e;
    }
  }

  async list(userId: string, query: TicketListQueryDto) {
    const { page, pageSize, skip, take } = this.normalizePagination(query);

    const where: Prisma.TicketWhereInput = {
      ...(query.status ? { status: query.status as TicketStatus } : {}),
      ...this.buildAssignedFilter(
        query.assigned as TicketAssignedFilter | undefined,
        userId,
      ),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        include: {
          conversation: {
            select: {
              id: true,
              status: true,
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
        orderBy: {
          updatedAt: 'desc',
        },
        skip,
        take,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
    };
  }

  async getById(_userId: string, id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        conversation: {
          select: {
            id: true,
            status: true,
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
    });

    if (!ticket) {
      notFound('TICKET_NOT_FOUND', 'Ticket not found.');
    }

    return ticket;
  }

  async update(userId: string, id: string, dto: UpdateTicketDto) {
    const existing = await this.prisma.ticket.findUnique({
      where: { id },
    });

    if (!existing) {
      notFound('TICKET_NOT_FOUND', 'Ticket not found.');
    }

    if (dto.assignedAgentId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.assignedAgentId },
      });
      if (!assignee) {
        badRequest('ASSIGNEE_NOT_FOUND', 'Assigned agent not found.');
      }
    }

    const data: Prisma.TicketUpdateInput = {};
    const changed: Record<string, any> = {};

    if (dto.status && dto.status !== existing.status) {
      data.status = dto.status;
      changed.status = dto.status;
    }

    if (dto.priority && dto.priority !== existing.priority) {
      data.priority = dto.priority;
      changed.priority = dto.priority;
    }

    if (
      dto.assignedAgentId &&
      dto.assignedAgentId !== existing.assignedAgentId
    ) {
      data.assignedAgentId = dto.assignedAgentId;
      changed.assignedAgentId = dto.assignedAgentId;
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data,
      include: {
        conversation: {
          select: {
            id: true,
            status: true,
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
    });

    await this.prisma.eventLog.create({
      data: {
        type: 'ticket.updated',
        conversationId: updated.conversationId,
        actorUserId: userId,
        metadata: {
          ticketId: updated.id,
          changed,
        },
      },
    });

    return updated;
  }
}

