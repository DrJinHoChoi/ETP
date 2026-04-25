import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DemandAggregatorService {
  private readonly logger = new Logger(DemandAggregatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 수요측 데이터를 집계한다.
   * CONSUMER 역할의 사용자들의 소비 데이터를 수집하여 집계 결과를 반환한다.
   */
  async aggregateDemand(from: Date, to: Date) {
    const consumers = await this.prisma.user.findMany({
      where: { role: 'CONSUMER', status: 'ACTIVE' },
      select: { id: true, name: true, organization: true },
    });

    const results = [];

    for (const consumer of consumers) {
      const readings = await this.prisma.meterReading.aggregate({
        where: {
          userId: consumer.id,
          timestamp: { gte: from, lte: to },
        },
        _sum: { consumption: true },
        _count: true,
        _avg: { consumption: true },
      });

      results.push({
        userId: consumer.id,
        name: consumer.name,
        organization: consumer.organization,
        totalConsumption: readings._sum.consumption || 0,
        avgConsumption: readings._avg.consumption || 0,
        readingCount: readings._count,
      });
    }

    this.logger.log(
      `수요 집계 완료: ${results.length}개 수요자, ${from.toISOString()} ~ ${to.toISOString()}`,
    );

    return {
      period: { from, to },
      consumers: results,
      totalDemand: results.reduce((sum, r) => sum + r.totalConsumption, 0),
    };
  }

  /**
   * 수요 예측 (최근 7일 평균 기반 단순 예측)
   */
  async forecastDemand(userId: string) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const avgData = await this.prisma.meterReading.aggregate({
      where: {
        userId,
        timestamp: { gte: sevenDaysAgo },
      },
      _avg: { consumption: true },
      _count: true,
    });

    const dailyAvg = avgData._avg.consumption || 0;

    return {
      userId,
      dailyAverage: dailyAvg,
      weeklyForecast: dailyAvg * 7,
      monthlyForecast: dailyAvg * 30,
      basedOnReadings: avgData._count,
    };
  }
}
