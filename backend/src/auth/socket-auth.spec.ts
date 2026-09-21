import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { authenticateSocket } from './socket-auth';
import { PrismaService } from '../prisma/prisma.service';

describe('authenticateSocket', () => {
  const jwtService = {
    verifyAsync: jest.fn(),
  } as unknown as JwtService;

  const prisma = {
    user: { findUnique: jest.fn() },
    customer: { findUnique: jest.fn() },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects missing tokens', async () => {
    await expect(
      authenticateSocket({ token: undefined, jwtService, prisma }),
    ).rejects.toBeInstanceOf(WsException);
  });

  it('rejects invalid tokens', async () => {
    (jwtService.verifyAsync as jest.Mock).mockRejectedValue(new Error('bad'));

    await expect(
      authenticateSocket({ token: 'bad', jwtService, prisma }),
    ).rejects.toBeInstanceOf(WsException);
  });

  it('rejects customer principals from using agent identity', async () => {
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'cust-1',
      typ: 'customer',
    });
    (prisma.customer.findUnique as jest.Mock).mockResolvedValue({
      id: 'cust-1',
    });

    const principal = await authenticateSocket({
      token: 'customer-token',
      jwtService,
      prisma,
    });

    expect(principal.kind).toBe('customer');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('authenticates a valid agent', async () => {
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'agent-1',
      typ: 'agent',
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'agent-1',
      role: 'AGENT',
      email: 'agent@local.test',
    });

    const principal = await authenticateSocket({
      token: 'agent-token',
      jwtService,
      prisma,
    });

    expect(principal).toEqual({
      kind: 'agent',
      userId: 'agent-1',
      role: 'AGENT',
      email: 'agent@local.test',
    });
  });
});
