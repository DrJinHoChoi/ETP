import { IsNumber, IsEnum, IsString, IsDateString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EnergySource } from '@prisma/client';

export class CreateMeterReadingDto {
  @ApiProperty({ example: 500, description: 'kWh 생산량' })
  @IsNumber()
  @Min(0)
  production: number;

  @ApiProperty({ example: 300, description: 'kWh 소비량' })
  @IsNumber()
  @Min(0)
  consumption: number;

  @ApiProperty({ enum: EnergySource, example: EnergySource.SOLAR })
  @IsEnum(EnergySource)
  source: EnergySource;

  @ApiProperty({ example: 'METER-001' })
  @IsString()
  deviceId: string;

  @ApiProperty({ example: '2025-03-15T14:00:00Z' })
  @IsDateString()
  timestamp: string;
}
