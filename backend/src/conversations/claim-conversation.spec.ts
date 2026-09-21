import { ConversationStatus, type Prisma } from '@prisma/client';
import { claimConversationAtomic } from './claim-conversation';

type ConvoRow = {
  id: string;
  status: ConversationStatus;
  assignedAgentId: string | null;
  assignedAt: Date | null;
};

function createTxMock(initial: ConvoRow) {
  const state: ConvoRow = { ...initial };
  const eventLogs: Array<Record<string, unknown>> = [];

  const tx = {
    conversation: {
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: {
            id: string;
            assignedAgentId: null;
            status: ConversationStatus;
          };
          data: { assignedAgentId: string; assignedAt: Date };
        }) => {
          if (
            state.id === where.id &&
            state.assignedAgentId === null &&
            state.status === where.status
          ) {
            state.assignedAgentId = data.assignedAgentId;
            state.assignedAt = data.assignedAt;
            return { count: 1 };
          }
          return { count: 0 };
        },
      ),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        if (state.id !== where.id) return null;
        return {
          id: state.id,
          status: state.status,
          assignedAgentId: state.assignedAgentId,
        };
      }),
      findUniqueOrThrow: jest.fn(async ({ where }: { where: { id: string } }) => {
        if (state.id !== where.id) {
          throw new Error('Conversation not found');
        }
        return {
          ...state,
          customer: { id: 'cust-1' },
          inbox: { id: 'inbox-1' },
          assignedAgent: state.assignedAgentId
            ? {
                id: state.assignedAgentId,
                name: 'Agent',
                email: 'agent@test.com',
              }
            : null,
          ticket: null,
        };
      }),
    },
    eventLog: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        eventLogs.push(data);
        return data;
      }),
    },
  } as unknown as Prisma.TransactionClient;

  return { tx, state, eventLogs };
}

describe('claimConversationAtomic', () => {
  const conversationId = '11111111-1111-1111-1111-111111111111';

  it('claims an unassigned OPEN conversation', async () => {
    const { tx, state, eventLogs } = createTxMock({
      id: conversationId,
      status: ConversationStatus.OPEN,
      assignedAgentId: null,
      assignedAt: null,
    });

    const result = await claimConversationAtomic(tx, 'agent-a', conversationId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.conversation.assignedAgentId).toBe('agent-a');
    }
    expect(state.assignedAgentId).toBe('agent-a');
    expect(eventLogs).toHaveLength(1);
    expect(eventLogs[0].type).toBe('conversation.claimed');
  });

  it('returns ALREADY_ASSIGNED when a second agent claims after the first', async () => {
    const { tx } = createTxMock({
      id: conversationId,
      status: ConversationStatus.OPEN,
      assignedAgentId: null,
      assignedAt: null,
    });

    const first = await claimConversationAtomic(tx, 'agent-a', conversationId);
    const second = await claimConversationAtomic(tx, 'agent-b', conversationId);

    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, reason: 'ALREADY_ASSIGNED' });
  });

  it('allows only one winner under concurrent claims', async () => {
    const { tx, state } = createTxMock({
      id: conversationId,
      status: ConversationStatus.OPEN,
      assignedAgentId: null,
      assignedAt: null,
    });

    const results = await Promise.all([
      claimConversationAtomic(tx, 'agent-a', conversationId),
      claimConversationAtomic(tx, 'agent-b', conversationId),
      claimConversationAtomic(tx, 'agent-c', conversationId),
    ]);

    const winners = results.filter((r) => r.ok);
    const losers = results.filter((r) => !r.ok);

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(2);
    expect(losers.every((r) => !r.ok && r.reason === 'ALREADY_ASSIGNED')).toBe(
      true,
    );
    expect(['agent-a', 'agent-b', 'agent-c']).toContain(state.assignedAgentId);
  });

  it('returns NOT_FOUND when conversation does not exist', async () => {
    const { tx } = createTxMock({
      id: conversationId,
      status: ConversationStatus.OPEN,
      assignedAgentId: null,
      assignedAt: null,
    });

    const result = await claimConversationAtomic(
      tx,
      'agent-a',
      '22222222-2222-2222-2222-222222222222',
    );

    expect(result).toEqual({ ok: false, reason: 'NOT_FOUND' });
  });

  it('returns CLOSED when conversation is closed', async () => {
    const { tx } = createTxMock({
      id: conversationId,
      status: ConversationStatus.CLOSED,
      assignedAgentId: null,
      assignedAt: null,
    });

    const result = await claimConversationAtomic(tx, 'agent-a', conversationId);

    expect(result).toEqual({ ok: false, reason: 'CLOSED' });
  });
});
