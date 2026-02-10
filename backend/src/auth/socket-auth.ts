import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { PrismaService } from '../prisma/prisma.service';

export type SocketAgent = {
  userId: string;
  role: 'ADMIN' | 'AGENT';
  email: string;
};

export type SocketCustomer = {
  customerId: string;
};

export type SocketPrincipal =
  | ({ kind: 'agent' } & SocketAgent)
  | ({ kind: 'customer' } & SocketCustomer);

type SocketAuthParams = {
  token: string | undefined;
  jwtService: JwtService;
  prisma: PrismaService;
};

export async function authenticateSocket({
  token,
  jwtService,
  prisma,
}: SocketAuthParams): Promise<SocketPrincipal> {
  if (!token) {
    throw new WsException({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing authentication token.',
      },
    });
  }

  let payload: any;
  try {
    payload = await jwtService.verifyAsync(token);
  } catch {
    throw new WsException({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid authentication token.',
      },
    });
  }

  if (payload.typ === 'agent') {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string },
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'AGENT')) {
      throw new WsException({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not allowed for socket connection.',
        },
      });
    }

    return {
      kind: 'agent',
      userId: user.id,
      role: user.role as SocketAgent['role'],
      email: user.email,
    };
  }

  if (payload.typ === 'customer') {
    const customer = await prisma.customer.findUnique({
      where: { id: payload.sub as string },
    });

    if (!customer) {
      throw new WsException({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Customer not found for provided token.',
        },
      });
    }

    return {
      kind: 'customer',
      customerId: customer.id,
    };
  }

  throw new WsException({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Invalid token type for socket connection.',
    },
  });
}

