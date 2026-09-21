import { HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WidgetService } from './widget.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WidgetService', () => {
  const prisma = {
    inbox: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    customer: {
      upsert: jest.fn(),
      create: jest.fn(),
    },
    conversation: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    eventLog: {
      create: jest.fn(),
    },
    message: {
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('customer-token'),
  } as unknown as JwtService;

  let service: WidgetService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WidgetService(prisma, jwtService);
    (prisma.eventLog.create as jest.Mock).mockResolvedValue({ id: 'evt-1' });
    (prisma.message.findMany as jest.Mock).mockResolvedValue([]);
  });

  it('creates a widget session with a new customer and conversation', async () => {
    (prisma.inbox.findFirst as jest.Mock).mockResolvedValue({
      id: 'inbox-1',
      name: 'Support',
    });
    (prisma.customer.create as jest.Mock).mockResolvedValue({
      id: 'cust-1',
      name: 'Ada',
      email: 'ada@example.com',
    });
    (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.conversation.create as jest.Mock).mockResolvedValue({
      id: 'conv-1',
      inboxId: 'inbox-1',
      customerId: 'cust-1',
      status: 'OPEN',
    });

    const result = await service.createSession({
      name: 'Ada',
      email: 'ada@example.com',
      pageUrl: 'https://example.com',
    });

    expect(result).toMatchObject({
      customerId: 'cust-1',
      conversationId: 'conv-1',
      customerToken: 'customer-token',
      createdNewConversation: true,
      messages: [],
    });
    expect(prisma.eventLog.create).toHaveBeenCalled();
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { sub: 'cust-1', typ: 'customer' },
      expect.objectContaining({ expiresIn: expect.any(String) }),
    );
  });

  it('reuses an existing OPEN conversation for the same customer', async () => {
    (prisma.inbox.findFirst as jest.Mock).mockResolvedValue({
      id: 'inbox-1',
      name: 'Support',
    });
    (prisma.customer.upsert as jest.Mock).mockResolvedValue({
      id: 'cust-1',
      externalId: 'ext-1',
    });
    (prisma.conversation.findFirst as jest.Mock).mockResolvedValue({
      id: 'conv-existing',
      inboxId: 'inbox-1',
      customerId: 'cust-1',
      status: 'OPEN',
    });

    const result = await service.createSession({
      externalId: 'ext-1',
      name: 'Ada',
    });

    expect(result.createdNewConversation).toBe(false);
    expect(result.conversationId).toBe('conv-existing');
    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });

  it('fails when a specific inboxId does not exist', async () => {
    (prisma.inbox.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      service.createSession({
        inboxId: '11111111-1111-1111-1111-111111111111',
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: { error: { code: 'INBOX_NOT_FOUND' } },
    });
  });

  it('fails when no inbox is configured', async () => {
    (prisma.inbox.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.createSession({})).rejects.toBeInstanceOf(HttpException);
  });
});
