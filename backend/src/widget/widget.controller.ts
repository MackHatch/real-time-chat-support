import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { WidgetService } from './widget.service';
import { WidgetSessionDto } from './widget.dto';
import { RateLimit } from '../ratelimit/ratelimit.decorator';
import { env } from '../config/env';

@ApiTags('widget')
@Controller('widget')
export class WidgetController {
  constructor(private readonly widgetService: WidgetService) {}

  @Post('session')
  @RateLimit({
    keyParts: ['widget', 'session', '{ip}', '{externalId}'],
    max: env.WIDGET_SESSION_MAX,
    windowSec: env.RATE_LIMIT_WINDOW_SECONDS,
  })
  async createSession(@Body() body: WidgetSessionDto, @Req() req: Request) {
    return this.widgetService.createSession(body);
  }
}

