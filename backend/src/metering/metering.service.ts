import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMeterReadingDto } from './dto/create-meter-reading.dto';

@Injectable()
export class MeteringService {
  constructor(private readonly prisma: PrismaService) {}

  async createReading(userId: string, dto: CreateMeterReadingDto) {
    return this.prisma.meterReading.create({
      data: {
        userId,
        production: dto.production,
        consumption: dto.consumption,
        source: dto.source,
        deviceId: dto.deviceId,
        timestamp: new Date(dto.timestamp),
      },
    });
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
