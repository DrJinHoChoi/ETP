import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DemandAggregatorService } from './demand-aggregator.service';
import { SupplyAggregatorService } from './supply-aggregator.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('어그리게이터')
@Controller('aggregator')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AggregatorController {
  constructor(
    private readonly demandAggregator: DemandAggregatorService,
    private readonly supplyAggregator: SupplyAggregatorService,
  ) {}

  @Get('demand')
  @ApiOperation({ summary: '수요 집계 데이터 조회' })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  getDemandAggregation(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.demandAggregator.aggregateDemand(new Date(from), new Date(to));
  }

  @Get('supply')
  @ApiOperation({ summary: '공급 집계 데이터 조회' })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  getSupplyAggregation(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.supplyAggregator.aggregateSupply(new Date(from), new Date(to));
  }

  @Get('supply/by-source')
  @ApiOperation({ summary: '에너지원별 공급 현황' })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  getSupplyBySource(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.supplyAggregator.getSupplyBySource(
      new Date(from),
      new Date(to),
    );
  }

  @Get('demand/forecast/:userId')
  @ApiOperation({ summary: '수요 예측' })
  getDemandForecast(@Param('userId') userId: string) {
    return this.demandAggregator.forecastDemand(userId);
  }
}
