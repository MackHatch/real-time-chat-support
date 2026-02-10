import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '../config/env';
import { AuthUser } from './auth.types';

type JwtPayload = {
  sub: string;
  email: string;
  role: 'ADMIN' | 'AGENT';
  typ: 'agent';
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private toAuthUser(user: {
    id: string;
    email: string;
    role: string;
    name: string;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role as AuthUser['role'],
      name: user.name,
    };
  }

  async validateUser(email: string, password: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return null;
    }

    return this.toAuthUser(user);
  }

  async login(email: string, password: string): Promise<{
    accessToken: string;
    user: AuthUser;
  }> {
    const user = await this.validateUser(email, password);

    if (!user) {
      throw new HttpException(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password.',
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      typ: 'agent',
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: env.JWT_ACCESS_SECRET,
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    });

    return {
      accessToken,
      user,
    };
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new HttpException(
        {
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found.',
          },
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return this.toAuthUser(user);
  }
}

