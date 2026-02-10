import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { RangeQueryDto } from './analytics.dto';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  async getSummary(@Query() query: RangeQueryDto) {
    const range = query.range ?? '7d';
    return this.analyticsService.getSummary(range);
  }

  @Get('tickets.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="tickets.csv"')
  async getTicketsCsv(@Query() query: RangeQueryDto) {
    const range = query.range ?? '7d';
    return this.analyticsService.getTicketsCsv(range);
  }
}

