import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ConversationStatus } from '@prisma/client';

export type AssignedFilter = 'me' | 'unassigned' | 'all';

export class ConversationListQueryDto {
  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;

  @IsOptional()
  @IsString()
  assigned?: AssignedFilter;

  @IsOptional()
  @IsUUID()
  inboxId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  @Type(() => Boolean)
  needsAttention?: boolean;
}

export class AssignConversationDto {
  @IsOptional()
  @IsUUID()
  agentId?: string | null;
}
