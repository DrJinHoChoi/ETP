import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MeteringService } from './metering.service';
import { CreateMeterReadingDto } from './dto/create-meter-reading.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('미터링')
@Controller('metering')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MeteringController {
  constructor(private readonly meteringService: MeteringService) {}

  @Post('readings')
  @ApiOperation({ summary: '미터링 데이터 전송' })
  createReading(@Req() req: any, @Body() dto: CreateMeterReadingDto) {
    return this.meteringService.createReading(req.user.id, dto);
  }

  @Get('readings')
  @ApiOperation({ summary: '미터링 데이터 조회' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'deviceId', required: false })
  getReadings(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('deviceId') deviceId?: string,
  ) {
    return this.meteringService.getReadings(req.user.id, {
      from,
      to,
      deviceId,
    });
  }

  @Get('aggregation')
  @ApiOperation({ summary: '미터링 집계 데이터 조회' })
  @ApiQuery({ name: 'period', enum: ['HOURLY', 'DAILY', 'MONTHLY'] })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  getAggregation(
    @Req() req: any,
    @Query('period') period: 'HOURLY' | 'DAILY' | 'MONTHLY',
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.meteringService.getAggregation(req.user.id, period, from, to);
  }
}
