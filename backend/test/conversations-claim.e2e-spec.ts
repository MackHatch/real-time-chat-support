import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ConversationsController } from '../src/conversations/conversations.controller';
import { ConversationsService } from '../src/conversations/conversations.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';

describe('Conversations claim (e2e)', () => {
  let app: INestApplication;
  const claim = jest.fn();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ConversationsController],
      providers: [
        {
          provide: ConversationsService,
          useValue: {
            list: jest.fn(),
            getDetail: jest.fn(),
            claim,
            close: jest.fn(),
            assign: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: { user: { findUnique: jest.fn() } },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { userId: 'agent-1' };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    claim.mockReset();
  });

  it('claims a conversation for the authenticated agent', async () => {
    const conversationId = '11111111-1111-1111-1111-111111111111';
    claim.mockResolvedValue({
      id: conversationId,
      assignedAgentId: 'agent-1',
    });

    const res = await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/claim`)
      .expect(201);

    expect(claim).toHaveBeenCalledWith('agent-1', conversationId);
    expect(res.body.assignedAgentId).toBe('agent-1');
  });
});
