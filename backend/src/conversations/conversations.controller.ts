import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ConversationsService } from './conversations.service';
import {
  ConversationListQueryDto,
  AssignConversationDto,
} from './conversations.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReqUser } from '../auth/request-user.decorator';
import { JwtRequestUser } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimit } from '../ratelimit/ratelimit.decorator';
import { env } from '../config/env';

@ApiTags('conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list(
    @ReqUser() user: JwtRequestUser,
    @Query() query: ConversationListQueryDto,
  ) {
    const result = await this.conversationsService.list(user.userId, query);
    return result;
  }

  @Get(':id')
  async getDetail(
    @ReqUser() user: JwtRequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const conversation = await this.conversationsService.getDetail(
      user.userId,
      id,
    );
    return conversation;
  }

  @Post(':id/claim')
  @RateLimit({
    keyParts: ['conversations', 'claim', '{userId}', '{ip}'],
    max: env.CLAIM_MAX,
    windowSec: env.RATE_LIMIT_WINDOW_SECONDS,
  })
  async claim(
    @ReqUser() user: JwtRequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ) {
    const conversation = await this.conversationsService.claim(
      user.userId,
      id,
    );
    return conversation;
  }

  @Post(':id/close')
  async close(
    @ReqUser() user: JwtRequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const conversation = await this.conversationsService.close(
      user.userId,
      id,
    );
    return conversation;
  }

  @Post(':id/assign')
  @RateLimit({
    keyParts: ['conversations', 'assign', '{userId}', '{ip}'],
    max: env.ASSIGN_MAX,
    windowSec: env.RATE_LIMIT_WINDOW_SECONDS,
  })
  async assign(
    @ReqUser() user: JwtRequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AssignConversationDto,
    @Req() req: Request,
  ) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { role: true },
    });

    if (!currentUser) {
      throw new Error('User not found');
    }

    const conversation = await this.conversationsService.assign(
      user.userId,
      currentUser.role,
      id,
      dto,
    );
    return conversation;
  }
}

