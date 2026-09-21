import { HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

describe('AuthService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
  } as unknown as PrismaService;

  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('test-token'),
  } as unknown as JwtService;

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(prisma, jwtService);
  });

  it('rejects invalid credentials', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.login('missing@test.com', 'bad')).rejects.toMatchObject(
      {
        status: HttpStatus.UNAUTHORIZED,
        response: {
          error: { code: 'INVALID_CREDENTIALS' },
        },
      },
    );
  });

  it('rejects wrong password', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'agent@local.test',
      passwordHash: 'hash',
      role: 'AGENT',
      name: 'Agent',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login('agent@local.test', 'wrong'),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('returns access token on successful login', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'agent@local.test',
      passwordHash: 'hash',
      role: 'AGENT',
      name: 'Agent',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.login('agent@local.test', 'Agent123!');

    expect(result.accessToken).toBe('test-token');
    expect(result.user).toEqual({
      id: 'user-1',
      email: 'agent@local.test',
      role: 'AGENT',
      name: 'Agent',
    });
  });
});
