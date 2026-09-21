import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { RateLimitModule } from '../ratelimit/ratelimit.module';
import { env } from '../config/env';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: env.JWT_ACCESS_SECRET,
      signOptions: {
        // Nest JWT typings expect ms.StringValue | number; env is a validated string like "15m"
        expiresIn: env.JWT_ACCESS_EXPIRES_IN as `${number}m` | `${number}h` | `${number}s` | `${number}d`,
      },
    }),
    PrismaModule,
    RateLimitModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}

