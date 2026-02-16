import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { SettlementService } from './settlement.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('정산')
@Controller('settlement')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Post(':tradeId')
  @ApiOperation({ summary: '정산 생성' })
  createSettlement(@Param('tradeId') tradeId: string) {
    return this.settlementService.createSettlement(tradeId);
  }

  @Get()
  @ApiOperation({ summary: '정산 내역 조회' })
  getSettlements(@Req() req: any) {
    return this.settlementService.getSettlements(req.user.id);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: '정산 확인' })
  confirmSettlement(@Param('id') id: string) {
    return this.settlementService.confirmSettlement(id);
  }

  @Get('stats')
  @ApiOperation({ summary: '정산 통계' })
  getStats(@Req() req: any) {
    return this.settlementService.getSettlementStats(req.user.id);
  }
}
