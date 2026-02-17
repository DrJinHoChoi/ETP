import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  Delete,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { TradingService } from './trading.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DIDAuthGuard } from '../auth/guards/did-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrderType, OrderStatus } from '@prisma/client';

@ApiTags('전력거래')
@Controller('trading')
@UseGuards(JwtAuthGuard, DIDAuthGuard)
@ApiBearerAuth()
export class TradingController {
  constructor(private readonly tradingService: TradingService) {}

  @Post('orders')
  @ApiOperation({ summary: '주문 생성' })
  createOrder(@Req() req: any, @Body() dto: CreateOrderDto) {
    return this.tradingService.createOrder(req.user.id, dto);
  }

  @Get('orders')
  @ApiOperation({ summary: '주문 목록 조회' })
  @ApiQuery({ name: 'type', enum: OrderType, required: false })
  @ApiQuery({ name: 'status', enum: OrderStatus, required: false })
  getOrders(
    @Query('type') type?: OrderType,
    @Query('status') status?: OrderStatus,
  ) {
    return this.tradingService.getOrders({ type, status });
  }

  @Get('orders/:id')
  @ApiOperation({ summary: '주문 상세 조회' })
  getOrderById(@Param('id') id: string) {
    return this.tradingService.getOrderById(id);
  }

  @Delete('orders/:id')
  @ApiOperation({ summary: '주문 취소' })
  cancelOrder(@Param('id') id: string, @Req() req: any) {
    return this.tradingService.cancelOrder(id, req.user.id);
  }

  @Get('trades')
  @ApiOperation({ summary: '체결 내역 조회' })
  getTrades(@Req() req: any) {
    return this.tradingService.getTrades(req.user.id);
  }

  @Get('stats')
  @ApiOperation({ summary: '거래 통계' })
  getTradingStats() {
    return this.tradingService.getTradingStats();
  }

  @Get('trades/recent')
  @ApiOperation({ summary: '최근 체결 내역 (대시보드 피드)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getRecentTrades(@Query('limit') limit?: string) {
    return this.tradingService.getRecentTrades(limit ? parseInt(limit, 10) : 10);
  }

  // ─── Admin 엔드포인트 ───

  @Get('admin/orders')
  @ApiOperation({ summary: '전체 주문 조회 (Admin)' })
  @ApiQuery({ name: 'status', enum: OrderStatus, required: false })
  @ApiQuery({ name: 'type', enum: OrderType, required: false })
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  getAdminOrders(
    @Query('status') status?: OrderStatus,
    @Query('type') type?: OrderType,
  ) {
    return this.tradingService.getAdminOrders({ status, type });
  }

  @Post('admin/orders/:id/cancel')
  @ApiOperation({ summary: '관리자 주문 강제 취소' })
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  adminCancelOrder(@Param('id') id: string) {
    return this.tradingService.adminCancelOrder(id);
  }
}
