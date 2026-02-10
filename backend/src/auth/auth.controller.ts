import { Body, Controller, Get, HttpException, HttpStatus, Post, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ReqUser } from './request-user.decorator';
import { JwtRequestUser } from './jwt.strategy';
import { RateLimit } from '../ratelimit/ratelimit.decorator';
import { env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('login')
  @RateLimit({
    keyParts: ['auth', 'login', '{ip}', '{email}'],
    max: env.AUTH_LOGIN_MAX,
    windowSec: env.RATE_LIMIT_WINDOW_SECONDS,
  })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    try {
      const result = await this.authService.login(dto.email, dto.password);
      
      // Audit: successful login
      await this.prisma.eventLog.create({
        data: {
          type: 'auth.login.success',
          actorUserId: result.user.id,
          metadata: {
            email: dto.email,
            ip: req.ip || req.socket.remoteAddress || 'unknown',
          },
        },
      }).catch(() => {
        // Ignore audit log errors
      });
      
      return result;
    } catch (err) {
      // Audit: failed login
      await this.prisma.eventLog.create({
        data: {
          type: 'auth.login.failed',
          metadata: {
            email: dto.email,
            ip: req.ip || req.socket.remoteAddress || 'unknown',
          },
        },
      }).catch(() => {
        // Ignore audit log errors
      });
      
      if (err instanceof HttpException) {
        throw err;
      }

      throw new HttpException(
        {
          error: {
            code: 'AUTH_LOGIN_FAILED',
            message: 'Failed to login.',
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@ReqUser() user: JwtRequestUser | undefined) {
    if (!user) {
      throw new HttpException(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Unauthorized.',
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const me = await this.authService.me(user.userId);
    return { user: me };
  }
}

