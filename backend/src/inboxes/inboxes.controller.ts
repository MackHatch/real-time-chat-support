import { Controller, Get, UseGuards } from '@nestjs/common';
import { InboxesService } from './inboxes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('inboxes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inboxes')
export class InboxesController {
  constructor(private readonly inboxesService: InboxesService) {}

  @Get()
  async list() {
    const items = await this.inboxesService.list();
    return { items };
  }
}

