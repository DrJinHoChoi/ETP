import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMeterReadingDto } from './dto/create-meter-reading.dto';
import { TokenService } from '../token/token.service';
import { EventsGateway } from '../common/gateways/events.gateway';

@Injectable()
export class MeteringService {
  private readonly logger = new Logger(MeteringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    @Optional() @Inject(TokenService) private readonly tokenService?: TokenService,
  ) {}

  async createReading(userId: string, dto: CreateMeterReadingDto) {
    const reading = await this.prisma.meterReading.create({
      data: {
        userId,
        production: dto.production,
        consumption: dto.consumption,
        source: dto.source,
        deviceId: dto.deviceId,
        timestamp: new Date(dto.timestamp),
      },
    });

    // 발전량 > 0이면 EPC 자동 발행
    if (dto.production > 0 && this.tokenService) {
      try {
        await this.tokenService.mintFromMeterReading(
          userId,
          dto.production,
          reading.id,
        );
        this.logger.log(
          `EPC ${dto.production} 발행 완료 (미터링: ${reading.id})`,
        );
      } catch (error) {
        this.logger.error(`EPC 발행 실패: ${error.message}`);
        // EPC 발행 실패는 미터링 데이터 저장에 영향을 주지 않음
      }
    }

    // WebSocket: 미터링 데이터 수신 알림
    this.eventsGateway.emitMeterReading({
      id: reading.id,
      userId,
      production: reading.production,
      consumption: reading.consumption,
      source: reading.source,
      deviceId: reading.deviceId,
      timestamp: reading.timestamp,
      netEnergy: reading.production - reading.consumption,
    });

    return reading;
  }

  async getReadings(
    userId: string,
    options?: { from?: string; to?: string; deviceId?: string },
  ) {
    return this.prisma.meterReading.findMany({
      where: {
        userId,
        deviceId: options?.deviceId,
        timestamp: {
          gte: options?.from ? new Date(options.from) : undefined,
          lte: options?.to ? new Date(options.to) : undefined,
        },
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  async getAggregation(
    userId: string,
    period: 'HOURLY' | 'DAILY' | 'MONTHLY',
    from: string,
    to: string,
  ) {
    const readings = await this.prisma.meterReading.findMany({
      where: {
        userId,
        timestamp: {
          gte: new Date(from),
          lte: new Date(to),
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    const totalProduction = readings.reduce((sum, r) => sum + r.production, 0);
    const totalConsumption = readings.reduce(
      (sum, r) => sum + r.consumption,
      0,
    );

    return {
      userId,
      period,
      startDate: from,
      endDate: to,
      totalProduction,
      totalConsumption,
      netEnergy: totalProduction - totalConsumption,
      readingCount: readings.length,
    };
  }
}
