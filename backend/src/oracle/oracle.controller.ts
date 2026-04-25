import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OracleService } from './oracle.service';
import { PriceHistoryQueryDto, PriceSourceParam } from './dto/price-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PriceSource } from '@prisma/client';

@ApiTags('가격 오라클')
@Controller('oracle')
export class OracleController {
  constructor(private readonly oracleService: OracleService) {}

  @Get('price/latest')
  @ApiOperation({ summary: '최신 바스켓 가격 조회' })
  async getLatestPrice() {
    const price = await this.oracleService.getLatestBasketPrice();
    if (!price) {
      return { message: '아직 가격 데이터가 없습니다', data: null };
    }
    return price;
  }

  @Get('price/history')
  @ApiOperation({ summary: '바스켓 가격 이력 조회' })
  async getBasketHistory(@Query() query: PriceHistoryQueryDto) {
    return this.oracleService.getBasketHistory(
      query.from ? new Date(query.from) : undefined,
      query.to ? new Date(query.to) : undefined,
    );
  }

  @Get('price/source')
  @ApiOperation({ summary: '소스별 가격 이력 조회' })
  async getPriceBySource(@Query() query: PriceHistoryQueryDto) {
    return this.oracleService.getPriceHistory(
      query.source as unknown as PriceSource,
      query.from ? new Date(query.from) : undefined,
      query.to ? new Date(query.to) : undefined,
    );
  }

  @Post('price/refresh')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: '가격 수동 갱신 (관리자)' })
  async refreshPrice() {
    const basket = await this.oracleService.fetchAndUpdatePrices();
    return { message: '가격 갱신 완료', data: basket };
  }
}
