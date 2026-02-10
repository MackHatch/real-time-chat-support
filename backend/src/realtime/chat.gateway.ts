import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '../config/env';
import { authenticateSocket, SocketAgent, SocketPrincipal } from '../auth/socket-auth';
import {
  ConversationActionDto,
  ConversationJoinDto,
  MessageSendDto,
} from './chat.dto';
import { shouldEmitTyping } from './chat.throttle';
import { ConversationStatus, MessageSenderType } from '@prisma/client';
import { WsException } from '@nestjs/websockets';
import { maybeAttachRedisAdapter } from './socket-redis.adapter';
import { RateLimitService } from '../ratelimit/ratelimit.service';
import { sanitizeText } from '../common/sanitize';
import { runWithSpan } from '../otel/tracing';
import { hashId } from '../otel/hash';
import { MetricsService } from '../metrics/metrics.service';

type ChatSocket = Socket & {
  data: {
    principal?: SocketPrincipal;
    agent?: SocketAgent;
    customerId?: string;
  };
};

@WebSocketGateway({
  cors: {
    origin: env.APP_ORIGIN,
    credentials: false,
  },
})
export class AgentChatGateway
  implements
    OnGatewayInit<Server>,
    OnGatewayConnection<ChatSocket>,
    OnGatewayDisconnect<ChatSocket>
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly rateLimitService: RateLimitService,
    private readonly metrics?: MetricsService,
  ) {}

  async afterInit(server: Server): Promise<void> {
    try {
      await maybeAttachRedisAdapter(server, env);
    } catch (error) {
      if (env.ENABLE_SOCKET_REDIS_ADAPTER) {
        // If adapter is enabled and connection fails, fail fast
        // eslint-disable-next-line no-console
        console.error('Failed to initialize Redis adapter:', error);
        throw error;
      }
      // If adapter is disabled, just log and continue
      // eslint-disable-next-line no-console
      console.warn('Redis adapter not enabled or connection failed:', error);
    }
  }

  private async getPrincipal(socket: ChatSocket): Promise<SocketPrincipal> {
    if (socket.data.principal) {
      return socket.data.principal;
    }

    const token = socket.handshake.auth?.token as string | undefined;
    const principal = await authenticateSocket({
      token,
      jwtService: this.jwtService,
      prisma: this.prisma,
    });
    socket.data.principal = principal;

    if (principal.kind === 'agent') {
      socket.data.agent = {
        userId: principal.userId,
        role: principal.role,
        email: principal.email,
      };
    } else if (principal.kind === 'customer') {
      socket.data.customerId = principal.customerId;
    }

    return principal;
  }

  private async getAgentFromSocket(socket: ChatSocket): Promise<SocketAgent> {
    const principal = await this.getPrincipal(socket);
    if (principal.kind !== 'agent') {
      this.emitError(socket, 'FORBIDDEN', 'Only agents can perform this action.');
    }
    return {
      userId: principal.userId,
      role: principal.role,
      email: principal.email,
    };
  }

  private async getCustomerIdFromSocket(socket: ChatSocket): Promise<string> {
    const principal = await this.getPrincipal(socket);
    if (principal.kind !== 'customer') {
      this.emitError(socket, 'FORBIDDEN', 'Only customers can perform this action.');
    }
    return principal.customerId;
  }

  private emitError(socket: ChatSocket, code: string, message: string, details?: any): never {
    const payload = { code, message, ...(details !== undefined ? { details } : {}) };
    socket.emit('error', payload);
    throw new WsException(payload);
  }

  private conversationRoom(conversationId: string): string {
    return `conversation:${conversationId}`;
  }

  private agentRoom(userId: string): string {
    return `agent:${userId}`;
  }

  private emitAgentNotification(userId: string, payload: any): void {
    this.server.to(this.agentRoom(userId)).emit('notification', payload);
  }

  private emitConversation(
    conversationId: string,
    event: string,
    payload: any,
  ): void {
    this.server.to(this.conversationRoom(conversationId)).emit(event, payload);
  }

  async handleConnection(socket: ChatSocket): Promise<void> {
    try {
      const principal = await this.getPrincipal(socket);
      
      // Trace: socket connection
      await runWithSpan(
        'ws.connect',
        {
          actorType: principal.kind,
          'actor.id_hash': hashId(
            principal.kind === 'agent' ? principal.userId : principal.customerId,
          ),
        },
        async () => {
          // Audit: socket connected
          await this.prisma.eventLog.create({
            data: {
              type: 'socket.connected',
              actorUserId: principal.kind === 'agent' ? principal.userId : null,
              metadata: {
                kind: principal.kind,
                ...(principal.kind === 'agent'
                  ? { userId: principal.userId, email: principal.email }
                  : { customerId: principal.customerId }),
              },
            },
          }).catch(() => {
            // Ignore audit log errors
          });
          
          if (principal.kind === 'agent') {
            socket.join(this.agentRoom(principal.userId));
          }
        },
      );

      // Metrics: count connection by type
      if (env.METRICS_ENABLED && this.metrics) {
        try {
          this.metrics.wsConnectionsTotal.inc({ type: principal.kind });
        } catch {
          // Ignore metrics errors
        }
      }
    } catch (err) {
      // authentication failed
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: ChatSocket): Promise<void> {
    // Audit: socket disconnected
    const principal = socket.data.principal;
    if (principal) {
      await this.prisma.eventLog.create({
        data: {
          type: 'socket.disconnected',
          actorUserId: principal.kind === 'agent' ? principal.userId : null,
          metadata: {
            kind: principal.kind,
            ...(principal.kind === 'agent'
              ? { userId: principal.userId, email: principal.email }
              : { customerId: principal.customerId }),
          },
        },
      }).catch(() => {
        // Ignore audit log errors
      });
    }
  }

  @SubscribeMessage('conversation.join')
  async handleConversationJoin(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() payload: ConversationJoinDto,
  ) {
    const principal = await this.getPrincipal(socket);

    // Metrics: message count and duration
    if (env.METRICS_ENABLED && this.metrics) {
      try {
        this.metrics.wsMessagesTotal.inc({
          event: 'conversation.join',
          actor_type: principal.kind,
        });
      } catch {
        // Ignore metrics errors
      }
    }
    const endTimer =
      env.METRICS_ENABLED && this.metrics
        ? this.metrics.wsEventDurationMs.startTimer({
            event: 'conversation.join',
          })
        : null;

    try {
      return await runWithSpan(
      'ws.conversation.join',
      {
        'conversation.id_hash': hashId(payload.conversationId),
        actorType: principal.kind,
        'actor.id_hash': hashId(
          principal.kind === 'agent' ? principal.userId : principal.customerId,
        ),
      },
      async () => {
        const conversation = await this.prisma.conversation.findUnique({
          where: { id: payload.conversationId },
          select: { id: true, customerId: true, status: true },
        });

        if (!conversation) {
          if (env.METRICS_ENABLED && this.metrics) {
            try {
              this.metrics.wsMessageRejectedTotal.inc({
                reason: 'validation_error',
              });
            } catch {
              // Ignore metrics errors
            }
          }
          this.emitError(
            socket,
            'CONVERSATION_NOT_FOUND',
            'Conversation not found.',
          );
        }

        if (principal.kind === 'customer') {
          if (
            conversation.customerId !== principal.customerId ||
            conversation.status !== ConversationStatus.OPEN
          ) {
            if (env.METRICS_ENABLED && this.metrics) {
              try {
                this.metrics.wsMessageRejectedTotal.inc({
                  reason: 'forbidden',
                });
              } catch {
                // Ignore metrics errors
              }
            }
            this.emitError(
              socket,
              'FORBIDDEN_CONVERSATION_ACCESS',
              'You are not allowed to join this conversation.',
            );
          }
        }

        socket.join(this.conversationRoom(payload.conversationId));

        return {
          ok: true,
          conversationId: payload.conversationId,
        };
      },
    );
    } finally {
      if (endTimer) {
        endTimer();
      }
    }
  }

  @SubscribeMessage('message.send')
  async handleMessageSend(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() payload: MessageSendDto,
  ) {
    const principal = await this.getPrincipal(socket);

    // Metrics: message count and duration
    if (env.METRICS_ENABLED && this.metrics) {
      try {
        this.metrics.wsMessagesTotal.inc({
          event: 'message.send',
          actor_type: principal.kind,
        });
      } catch {
        // Ignore metrics errors
      }
    }
    const endTimer =
      env.METRICS_ENABLED && this.metrics
        ? this.metrics.wsEventDurationMs.startTimer({
            event: 'message.send',
          })
        : null;

    try {
      return await runWithSpan(
        'ws.message.send',
        {
          'conversation.id_hash': hashId(payload.conversationId),
          actorType: principal.kind,
          'actor.id_hash': hashId(
            principal.kind === 'agent' ? principal.userId : principal.customerId,
          ),
        },
        async () => {
          // Rate limiting (if enabled)
          if (env.RATE_LIMIT_ENABLED) {
            const rateLimitKey =
              principal.kind === 'agent'
                ? `ws:msg:agent:${principal.userId}`
                : `ws:msg:cust:${principal.customerId}`;

            const rateLimitResult = await this.rateLimitService.consume(
              rateLimitKey,
              env.SOCKET_MESSAGE_MAX_PER_10S,
              10, // 10 second window
            );

            if (!rateLimitResult.allowed) {
              if (env.METRICS_ENABLED && this.metrics) {
                try {
                  this.metrics.wsMessageRejectedTotal.inc({
                    reason: 'rate_limited',
                  });
                } catch {
                  // Ignore metrics errors
                }
              }
              const retryAfter = Math.ceil(
                (rateLimitResult.resetAtMs - Date.now()) / 1000,
              );
              this.emitError(socket, 'RATE_LIMITED', 'Rate limit exceeded.', {
                retryAfterSeconds: retryAfter,
              });
              return;
            }
          }

        const conversation = await this.prisma.conversation.findUnique({
          where: { id: payload.conversationId },
          include: {
            assignedAgent: {
              select: {
                id: true,
              },
            },
          },
        });

        if (!conversation) {
          if (env.METRICS_ENABLED && this.metrics) {
            try {
              this.metrics.wsMessageRejectedTotal.inc({
                reason: 'validation_error',
              });
            } catch {
              // Ignore metrics errors
            }
          }
          this.emitError(
            socket,
            'CONVERSATION_NOT_FOUND',
            'Conversation not found.',
          );
        }

        if (conversation.status === ConversationStatus.CLOSED) {
          if (env.METRICS_ENABLED && this.metrics) {
            try {
              this.metrics.wsMessageRejectedTotal.inc({
                reason: 'validation_error',
              });
            } catch {
              // Ignore metrics errors
            }
          }
          this.emitError(
            socket,
            'CONVERSATION_CLOSED',
            'Conversation is closed.',
          );
        }

        // Sanitize message body
        const sanitizedBody = sanitizeText(payload.body);

        const now = new Date();

        if (principal.kind === 'agent') {
      const message = await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderType: MessageSenderType.AGENT,
          senderUserId: principal.userId,
          body: sanitizedBody,
          createdAt: now,
        },
      });

      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: now,
          lastAgentMessageAt: now,
        },
      });

      await this.prisma.eventLog.create({
        data: {
          type: 'message.created',
          conversationId: conversation.id,
          actorUserId: principal.userId,
          metadata: {
            senderType: 'AGENT',
            messageId: message.id,
          },
        },
      });

      this.emitConversation(conversation.id, 'message.created', {
        conversationId: conversation.id,
        message,
      });

      if (conversation.assignedAgent?.id) {
        this.emitAgentNotification(conversation.assignedAgent.id, {
          type: 'message.created',
          payload: {
            conversationId: conversation.id,
          },
        });
      }

      return { ok: true };
    }

    // customer sending
    if (conversation.customerId !== principal.customerId) {
      this.emitError(
        socket,
        'FORBIDDEN_CONVERSATION_ACCESS',
        'You are not allowed to send messages to this conversation.',
      );
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: MessageSenderType.CUSTOMER,
        senderCustomerId: principal.customerId,
        body: sanitizedBody,
        createdAt: now,
      },
    });

    const wasUnassigned = !conversation.assignedAgentId;

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: now,
        lastCustomerMessageAt: now,
      },
    });

    await this.prisma.eventLog.create({
      data: {
        type: 'message.created',
        conversationId: conversation.id,
        actorUserId: null,
        metadata: {
          senderType: 'CUSTOMER',
          customerId: principal.customerId,
          messageId: message.id,
        },
      },
    });

    this.emitConversation(conversation.id, 'message.created', {
      conversationId: conversation.id,
      message,
    });

    if (conversation.assignedAgent?.id) {
      this.emitAgentNotification(conversation.assignedAgent.id, {
        type: 'message.created',
        payload: {
          conversationId: conversation.id,
        },
      });
    } else if (wasUnassigned) {
      // Emit notification to all agents when unassigned conversation receives a message
      this.server.emit('notification', {
        type: 'conversation.unassigned_message',
        payload: {
          conversationId: conversation.id,
        },
      });
    }

        return { ok: true };
      },
    );
    } finally {
      if (endTimer) {
        endTimer();
      }
    }
  }

  @SubscribeMessage('conversation.claim')
  async handleConversationClaim(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() payload: ConversationActionDto,
  ) {
    const agent = await this.getAgentFromSocket(socket);

    // Metrics: message count and duration
    if (env.METRICS_ENABLED && this.metrics) {
      try {
        this.metrics.wsMessagesTotal.inc({
          event: 'conversation.claim',
          actor_type: 'agent',
        });
      } catch {
        // Ignore metrics errors
      }
    }
    const endTimer =
      env.METRICS_ENABLED && this.metrics
        ? this.metrics.wsEventDurationMs.startTimer({
            event: 'conversation.claim',
          })
        : null;

    try {
      return await runWithSpan(
        'ws.conversation.claim',
        {
          'conversation.id_hash': hashId(payload.conversationId),
          actorType: 'agent',
          'actor.id_hash': hashId(agent.userId),
        },
        async () => {
          try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const convo = await tx.conversation.findUnique({
          where: { id: payload.conversationId },
          select: {
            id: true,
            status: true,
            assignedAgentId: true,
          },
        });

        if (!convo) {
          this.emitError(
            socket,
            'CONVERSATION_NOT_FOUND',
            'Conversation not found.',
          );
        }

        if (convo.status === ConversationStatus.CLOSED) {
          this.emitError(
            socket,
            'CONVERSATION_CLOSED',
            'Conversation is already closed.',
          );
        }

        if (convo.assignedAgentId) {
          this.emitError(
            socket,
            'CONVERSATION_ALREADY_ASSIGNED',
            'Conversation is already assigned.',
          );
        }

        const now = new Date();
        const updatedConversation = await tx.conversation.update({
          where: { id: payload.conversationId },
          data: {
            assignedAgentId: agent.userId,
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
            conversationId: updatedConversation.id,
            actorUserId: agent.userId,
            metadata: {
              previousAssignedAgentId: null,
              newAssignedAgentId: agent.userId,
            },
          },
        });

        return updatedConversation;
      });

      this.emitConversation(payload.conversationId, 'conversation.updated', {
        conversation: updated,
      });

      this.emitAgentNotification(agent.userId, {
        type: 'conversation.claimed',
        payload: {
          conversationId: payload.conversationId,
        },
      });

            return { ok: true };
          } catch (err) {
            if (err instanceof WsException) {
              throw err;
            }
            if (env.METRICS_ENABLED && this.metrics) {
              try {
                this.metrics.wsMessageRejectedTotal.inc({
                  reason: 'internal_error',
                });
              } catch {
                // Ignore metrics errors
              }
            }
            this.emitError(socket, 'CONVERSATION_CLAIM_FAILED', 'Failed to claim conversation.');
          }
        },
      );
    } finally {
      if (endTimer) {
        endTimer();
      }
    }
  }

  @SubscribeMessage('conversation.close')
  async handleConversationClose(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() payload: ConversationActionDto,
  ) {
    const agent = await this.getAgentFromSocket(socket);

    // Metrics: message count and duration
    if (env.METRICS_ENABLED && this.metrics) {
      try {
        this.metrics.wsMessagesTotal.inc({
          event: 'conversation.close',
          actor_type: 'agent',
        });
      } catch {
        // Ignore metrics errors
      }
    }
    const endTimer =
      env.METRICS_ENABLED && this.metrics
        ? this.metrics.wsEventDurationMs.startTimer({
            event: 'conversation.close',
          })
        : null;

    try {
      return await runWithSpan(
        'ws.conversation.close',
        {
          'conversation.id_hash': hashId(payload.conversationId),
          actorType: 'agent',
          'actor.id_hash': hashId(agent.userId),
        },
        async () => {
          try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const convo = await tx.conversation.findUnique({
          where: { id: payload.conversationId },
          select: {
            id: true,
            status: true,
          },
        });

        if (!convo) {
          this.emitError(
            socket,
            'CONVERSATION_NOT_FOUND',
            'Conversation not found.',
          );
        }

        if (convo.status === ConversationStatus.CLOSED) {
          await tx.eventLog.create({
            data: {
              type: 'conversation.closed',
              conversationId: convo.id,
              actorUserId: agent.userId,
              metadata: {
                alreadyClosed: true,
              },
            },
          });

          const existing = await tx.conversation.findUnique({
            where: { id: payload.conversationId },
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
            this.emitError(
              socket,
              'CONVERSATION_NOT_FOUND',
              'Conversation not found.',
            );
          }

          return existing;
        }

        const updatedConversation = await tx.conversation.update({
          where: { id: payload.conversationId },
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
            conversationId: updatedConversation.id,
            actorUserId: agent.userId,
            metadata: {
              by: agent.userId,
            },
          },
        });

        return updatedConversation;
      });

      this.emitConversation(payload.conversationId, 'conversation.updated', {
        conversation: updated,
      });

          return { ok: true };
        } catch (err) {
          if (err instanceof WsException) {
            throw err;
          }
          this.emitError(socket, 'CONVERSATION_CLOSE_FAILED', 'Failed to close conversation.');
        }
      },
    );
  }

  @SubscribeMessage('typing.start')
  async handleTypingStart(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() payload: ConversationActionDto,
  ) {
    const principal = await this.getPrincipal(socket);

    return await runWithSpan(
      'ws.typing.start',
      {
        'conversation.id_hash': hashId(payload.conversationId),
        actorType: principal.kind,
        'actor.id_hash': hashId(
          principal.kind === 'agent' ? principal.userId : principal.customerId,
        ),
      },
      async () => {
        if (!shouldEmitTyping(socket.id, payload.conversationId)) {
          return;
        }

        const actorId =
          principal.kind === 'agent' ? principal.userId : principal.customerId;

        this.emitConversation(payload.conversationId, 'typing.updated', {
          conversationId: payload.conversationId,
          actorId,
          isTyping: true,
        });
      },
    );
    // Note: Typing events are lightweight, no metrics needed
  }

  @SubscribeMessage('typing.stop')
  async handleTypingStop(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() payload: ConversationActionDto,
  ) {
    const principal = await this.getPrincipal(socket);

    return await runWithSpan(
      'ws.typing.stop',
      {
        'conversation.id_hash': hashId(payload.conversationId),
        actorType: principal.kind,
        'actor.id_hash': hashId(
          principal.kind === 'agent' ? principal.userId : principal.customerId,
        ),
      },
      async () => {
        if (!shouldEmitTyping(socket.id, payload.conversationId)) {
          return;
        }

        const actorId =
          principal.kind === 'agent' ? principal.userId : principal.customerId;

        this.emitConversation(payload.conversationId, 'typing.updated', {
          conversationId: payload.conversationId,
          actorId,
          isTyping: false,
        });
      },
    );
    // Note: Typing events are lightweight, no metrics needed
  }
}

