import { IsIn, IsOptional } from 'class-validator';

export type AnalyticsRange = '7d' | '30d' | '90d';

export class RangeQueryDto {
  @IsOptional()
  @IsIn(['7d', '30d', '90d'])
  range?: AnalyticsRange;
}

