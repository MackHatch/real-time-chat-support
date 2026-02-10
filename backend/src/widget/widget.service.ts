import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { WidgetSessionDto } from './widget.dto';
import { env } from '../config/env';

@Injectable()
export class WidgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async createSession(body: WidgetSessionDto) {
    // Pick inbox
    let inbox;
    if (body.inboxId != null) {
      inbox = await this.prisma.inbox.findUnique({
        where: { id: body.inboxId },
      });
      if (!inbox) {
        throw new HttpException(
          {
            error: {
              code: 'INBOX_NOT_FOUND',
              message: 'The specified inbox was not found.',
            },
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    } else {
      inbox = await this.prisma.inbox.findFirst({
        orderBy: { createdAt: 'asc' },
      });
      if (!inbox) {
        throw new HttpException(
          {
            error: {
              code: 'INBOX_NOT_CONFIGURED',
              message: 'No inbox is configured for widget sessions.',
            },
          },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    // Upsert / create customer
    let customer;
    if (body.externalId) {
      customer = await this.prisma.customer.upsert({
        where: { externalId: body.externalId },
        update: {
          name: body.name ?? undefined,
          email: body.email ?? undefined,
        },
        create: {
          externalId: body.externalId,
          name: body.name ?? undefined,
          email: body.email ?? undefined,
        },
      });
    } else {
      customer = await this.prisma.customer.create({
        data: {
          name: body.name ?? undefined,
          email: body.email ?? undefined,
        },
      });
    }

    // Find or create OPEN conversation
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        inboxId: inbox.id,
        customerId: customer.id,
        status: 'OPEN',
      },
    });

    let createdNewConversation = false;

    // Create session event log (before conversation check)
    const sessionMetadata: Record<string, any> = {
      customerId: customer.id,
      inboxId: inbox.id,
    };
    if (body.pageUrl) sessionMetadata.pageUrl = body.pageUrl;
    if (body.referrer) sessionMetadata.referrer = body.referrer;
    if (body.userAgent) sessionMetadata.userAgent = body.userAgent;

    let sessionEventLogId: string | null = null;

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          inboxId: inbox.id,
          customerId: customer.id,
          status: 'OPEN',
        },
      });
      createdNewConversation = true;

      const conversationMetadata: Record<string, any> = {
        customerId: customer.id,
        inboxId: inbox.id,
      };
      if (body.pageUrl) conversationMetadata.pageUrl = body.pageUrl;
      if (body.referrer) conversationMetadata.referrer = body.referrer;
      if (body.userAgent) conversationMetadata.userAgent = body.userAgent;

      await this.prisma.eventLog.create({
        data: {
          type: 'conversation.created',
          conversationId: conversation.id,
          actorUserId: null,
          metadata: conversationMetadata,
        },
      });

      // Create widget.session event with conversationId
      const sessionEvent = await this.prisma.eventLog.create({
        data: {
          type: 'widget.session',
          conversationId: conversation.id,
          actorUserId: null,
          metadata: {
            ...sessionMetadata,
            customerId: customer.id, // Ensure customerId is in metadata
          },
        },
      });
      sessionEventLogId = sessionEvent.id;
    } else {
      // Create widget.session event with existing conversationId
      const sessionEvent = await this.prisma.eventLog.create({
        data: {
          type: 'widget.session',
          conversationId: conversation.id,
          actorUserId: null,
          metadata: {
            ...sessionMetadata,
            customerId: customer.id, // Ensure customerId is in metadata
          },
        },
      });
      sessionEventLogId = sessionEvent.id;
    }

    const messagesDesc = await this.prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const messages = [...messagesDesc].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    const customerToken = await this.jwtService.signAsync(
      {
        sub: customer.id,
        typ: 'customer',
      },
      {
        secret: env.JWT_ACCESS_SECRET,
        expiresIn: env.WIDGET_TOKEN_EXPIRES_IN ?? '1h',
      },
    );

    return {
      customerId: customer.id,
      conversationId: conversation.id,
      customerToken,
      messages,
      createdNewConversation,
    };
  }
}

