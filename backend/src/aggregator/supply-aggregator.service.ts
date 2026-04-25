import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SupplyAggregatorService {
  private readonly logger = new Logger(SupplyAggregatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 공급측 데이터를 집계한다.
   * SUPPLIER 역할의 사용자들의 생산 데이터를 수집하여 에너지원별 집계 결과를 반환한다.
   */
  async aggregateSupply(from: Date, to: Date) {
    const suppliers = await this.prisma.user.findMany({
      where: { role: 'SUPPLIER', status: 'ACTIVE' },
      select: { id: true, name: true, organization: true },
    });

    const results = [];

    for (const supplier of suppliers) {
      const readings = await this.prisma.meterReading.aggregate({
        where: {
          userId: supplier.id,
          timestamp: { gte: from, lte: to },
        },
        _sum: { production: true },
        _count: true,
        _avg: { production: true },
      });

      // 에너지원별 그룹핑
      const bySource = await this.prisma.meterReading.groupBy({
        by: ['source'],
        where: {
          userId: supplier.id,
          timestamp: { gte: from, lte: to },
        },
        _sum: { production: true },
      });

      results.push({
        userId: supplier.id,
        name: supplier.name,
        organization: supplier.organization,
        totalProduction: readings._sum.production || 0,
        avgProduction: readings._avg.production || 0,
        readingCount: readings._count,
        bySource: bySource.map((s) => ({
          source: s.source,
          total: s._sum.production || 0,
        })),
      });
    }

    this.logger.log(
      `공급 집계 완료: ${results.length}개 공급자, ${from.toISOString()} ~ ${to.toISOString()}`,
    );

    return {
      period: { from, to },
      suppliers: results,
      totalSupply: results.reduce((sum, r) => sum + r.totalProduction, 0),
    };
  }

  /**
   * 에너지원별 공급 현황
   */
  async getSupplyBySource(from: Date, to: Date) {
    const bySource = await this.prisma.meterReading.groupBy({
      by: ['source'],
      where: {
        timestamp: { gte: from, lte: to },
        production: { gt: 0 },
      },
      _sum: { production: true },
      _count: true,
    });

    return bySource.map((s) => ({
      source: s.source,
      totalProduction: s._sum.production || 0,
      readingCount: s._count,
    }));
  }
}
