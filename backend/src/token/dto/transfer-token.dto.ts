import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class TransferTokenDto {
  @ApiProperty({ description: '수신자 ID' })
  @IsString()
  toUserId: string;

  @ApiProperty({ description: 'EPC 수량', minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ description: '이체 사유' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdminMintDto {
  @ApiProperty({ description: '대상 사용자 ID' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'EPC 발행량', minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: '발행 사유' })
  @IsString()
  reason: string;
}

export class TransferRECDto {
  @ApiProperty({ description: '수신자 ID' })
  @IsString()
  toUserId: string;
}
