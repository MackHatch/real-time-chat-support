import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ConversationsController } from '../src/conversations/conversations.controller';
import { ConversationsService } from '../src/conversations/conversations.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RateLimitInterceptor } from '../src/ratelimit/ratelimit.interceptor';
import { RateLimitService } from '../src/ratelimit/ratelimit.service';

describe('Conversations auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ConversationsController],
      providers: [
        {
          provide: ConversationsService,
          useValue: {
            list: jest.fn(),
            getDetail: jest.fn(),
            claim: jest.fn(),
            close: jest.fn(),
            assign: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: { user: { findUnique: jest.fn() } },
        },
        {
          provide: RateLimitService,
          useValue: {
            consume: jest.fn().mockResolvedValue({
              allowed: true,
              remaining: 10,
              resetAtMs: Date.now() + 60_000,
            }),
          },
        },
        RateLimitInterceptor,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (_context: ExecutionContext) => {
          throw new UnauthorizedException({
            error: { code: 'UNAUTHORIZED', message: 'Unauthorized.' },
          });
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('rejects unauthenticated conversation list access', async () => {
    await request(app.getHttpServer()).get('/api/conversations').expect(401);
  });

  it('rejects unauthenticated claim attempts', async () => {
    await request(app.getHttpServer())
      .post('/api/conversations/11111111-1111-1111-1111-111111111111/claim')
      .expect(401);
  });
});
