import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('분석')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('re100')
  @ApiOperation({ summary: 'RE100 달성률 조회' })
  @ApiQuery({ name: 'year', required: false })
  getRE100Achievement(
    @Req() req: any,
    @Query('year') year?: string,
  ) {
    return this.analyticsService.getRE100Achievement(
      req.user.id,
      year ? parseInt(year) : new Date().getFullYear(),
    );
  }

  @Get('carbon')
  @ApiOperation({ summary: '탄소 감축량 조회' })
  @ApiQuery({ name: 'year', required: false })
  getCarbonReduction(
    @Req() req: any,
    @Query('year') year?: string,
  ) {
    return this.analyticsService.getCarbonReduction(
      req.user.id,
      year ? parseInt(year) : undefined,
    );
  }

  @Get('platform')
  @ApiOperation({ summary: '플랫폼 전체 통계' })
  getPlatformStats() {
    return this.analyticsService.getPlatformStats();
  }

  @Get('trend/:year')
  @ApiOperation({ summary: '월별 거래 트렌드' })
  getMonthlyTrend(@Param('year') year: string) {
    return this.analyticsService.getMonthlyTrend(parseInt(year));
  }
}
