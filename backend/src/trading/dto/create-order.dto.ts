import { IsEnum, IsNumber, IsDateString, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderType, EnergySource, PaymentCurrency } from '@prisma/client';

export class CreateOrderDto {
  @ApiProperty({ enum: OrderType, example: OrderType.BUY })
  @IsEnum(OrderType)
  type: OrderType;

  @ApiProperty({ enum: EnergySource, example: EnergySource.SOLAR })
  @IsEnum(EnergySource)
  energySource: EnergySource;

  @ApiProperty({ example: 1000, description: 'kWh 단위' })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 120, description: 'KRW or EPC per kWh' })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ example: '2025-03-01T00:00:00Z' })
  @IsDateString()
  validFrom: string;

  @ApiProperty({ example: '2025-03-31T23:59:59Z' })
  @IsDateString()
  validUntil: string;

  @ApiPropertyOptional({ enum: PaymentCurrency, default: PaymentCurrency.KRW })
  @IsOptional()
  @IsEnum(PaymentCurrency)
  paymentCurrency?: PaymentCurrency;
}
