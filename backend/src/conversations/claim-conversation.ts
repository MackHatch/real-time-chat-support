import {
  ConversationStatus,
  Prisma,
  type Conversation,
  type Customer,
  type Inbox,
  type Ticket,
  type User,
} from '@prisma/client';

export type ClaimedConversation = Conversation & {
  customer: Customer;
  inbox: Inbox;
  assignedAgent: Pick<User, 'id' | 'name' | 'email'> | null;
  ticket: Pick<Ticket, 'id' | 'status' | 'priority'> | null;
};

export type ClaimConversationResult =
  | { ok: true; conversation: ClaimedConversation }
  | {
      ok: false;
      reason: 'NOT_FOUND' | 'CLOSED' | 'ALREADY_ASSIGNED' | 'CLAIM_FAILED';
    };

const claimInclude = {
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
} satisfies Prisma.ConversationInclude;

/**
 * Atomically claim an unassigned OPEN conversation.
 * Uses updateMany with assignedAgentId: null so concurrent claimants cannot both succeed.
 */
export async function claimConversationAtomic(
  tx: Prisma.TransactionClient,
  userId: string,
  conversationId: string,
): Promise<ClaimConversationResult> {
  const now = new Date();

  const claimResult = await tx.conversation.updateMany({
    where: {
      id: conversationId,
      assignedAgentId: null,
      status: ConversationStatus.OPEN,
    },
    data: {
      assignedAgentId: userId,
      assignedAt: now,
    },
  });

  if (claimResult.count !== 1) {
    const convo = await tx.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        status: true,
        assignedAgentId: true,
      },
    });

    if (!convo) {
      return { ok: false, reason: 'NOT_FOUND' };
    }
    if (convo.status === ConversationStatus.CLOSED) {
      return { ok: false, reason: 'CLOSED' };
    }
    if (convo.assignedAgentId) {
      return { ok: false, reason: 'ALREADY_ASSIGNED' };
    }
    return { ok: false, reason: 'CLAIM_FAILED' };
  }

  const updated = await tx.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: claimInclude,
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

  return { ok: true, conversation: updated };
}
