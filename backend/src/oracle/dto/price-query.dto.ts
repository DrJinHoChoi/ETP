import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export enum PriceSourceParam {
  EIA = 'EIA',
  ENTSOE = 'ENTSOE',
  KPX = 'KPX',
}

export class PriceHistoryQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: PriceSourceParam })
  @IsOptional()
  @IsEnum(PriceSourceParam)
  source?: PriceSourceParam;
}
