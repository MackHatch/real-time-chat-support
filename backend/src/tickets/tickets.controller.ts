import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import {
  CreateTicketDto,
  TicketListQueryDto,
  UpdateTicketDto,
} from './tickets.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReqUser } from '../auth/request-user.decorator';
import { JwtRequestUser } from '../auth/jwt.strategy';

@ApiTags('tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  async create(
    @ReqUser() user: JwtRequestUser,
    @Body() dto: CreateTicketDto,
  ) {
    const ticket = await this.ticketsService.create(user.userId, dto);
    return ticket;
  }

  @Get()
  async list(
    @ReqUser() user: JwtRequestUser,
    @Query() query: TicketListQueryDto,
  ) {
    const result = await this.ticketsService.list(user.userId, query);
    return result;
  }

  @Get(':id')
  async getById(
    @ReqUser() user: JwtRequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const ticket = await this.ticketsService.getById(user.userId, id);
    return ticket;
  }

  @Patch(':id')
  async update(
    @ReqUser() user: JwtRequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    const ticket = await this.ticketsService.update(user.userId, id, dto);
    return ticket;
  }
}

