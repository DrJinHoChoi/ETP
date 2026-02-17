import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// 탄소 감축 계수 (kWh당 CO2 감축량 in kg)
const CARBON_REDUCTION_FACTOR: Record<string, number> = {
  SOLAR: 0.45,
  WIND: 0.48,
  HYDRO: 0.02,
  BIOMASS: 0.23,
  GEOTHERMAL: 0.04,
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * RE100 달성률 계산
   * 해당 사용자의 재생에너지 구매량 / 총 소비량 * 100
   */
  async getRE100Achievement(userId: string, year: number) {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    // 총 소비량
    const consumption = await this.prisma.meterReading.aggregate({
      where: {
        userId,
        timestamp: { gte: startOfYear, lte: endOfYear },
      },
      _sum: { consumption: true },
    });

    // REC 인증서를 통한 재생에너지 구매량
    const recPurchased = await this.prisma.rECCertificate.aggregate({
      where: {
        consumerId: userId,
        issuedAt: { gte: startOfYear, lte: endOfYear },
      },
      _sum: { quantity: true },
    });

    const totalConsumption = consumption._sum.consumption || 0;
    const totalRenewable = recPurchased._sum.quantity || 0;
    const achievementRate =
      totalConsumption > 0 ? (totalRenewable / totalConsumption) * 100 : 0;

    return {
      userId,
      year,
      totalConsumption,
      totalRenewable,
      achievementRate: Math.min(achievementRate, 100),
      targetRate: 100,
      gap: Math.max(0, totalConsumption - totalRenewable),
    };
  }

  /**
   * 탄소 감축량 계산
   */
  async getCarbonReduction(userId?: string, year?: number) {
    const startDate = year
      ? new Date(year, 0, 1)
      : new Date(new Date().getFullYear(), 0, 1);
    const endDate = year
      ? new Date(year, 11, 31, 23, 59, 59)
      : new Date();

    const whereClause: any = {
      issuedAt: { gte: startDate, lte: endDate },
    };
    if (userId) {
      whereClause.consumerId = userId;
    }

    const certs = await this.prisma.rECCertificate.findMany({
      where: whereClause,
      select: {
        energySource: true,
        quantity: true,
      },
    });

    let totalReduction = 0;
    const bySource: Record<string, { quantity: number; reduction: number }> =
      {};

    for (const cert of certs) {
      const factor = CARBON_REDUCTION_FACTOR[cert.energySource] || 0.4;
      const reduction = cert.quantity * factor;
      totalReduction += reduction;

      if (!bySource[cert.energySource]) {
        bySource[cert.energySource] = { quantity: 0, reduction: 0 };
      }
      bySource[cert.energySource].quantity += cert.quantity;
      bySource[cert.energySource].reduction += reduction;
    }

    return {
      userId,
      period: { from: startDate, to: endDate },
      totalCarbonReduction: totalReduction, // kg CO2
      totalCarbonReductionTons: totalReduction / 1000, // ton CO2
      bySource,
      certificateCount: certs.length,
    };
  }

  /**
   * 플랫폼 전체 통계
   */
  async getPlatformStats() {
    const [userCount, orderCount, tradeStats, settlementStats] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.order.count(),
        this.prisma.trade.aggregate({
          _count: true,
          _sum: { quantity: true, totalAmount: true },
          _avg: { price: true },
        }),
        this.prisma.settlement.aggregate({
          where: { status: 'COMPLETED' },
          _count: true,
          _sum: { amount: true, fee: true },
        }),
      ]);

    const usersByRole = await this.prisma.user.groupBy({
      by: ['role'],
      _count: true,
    });

    return {
      users: {
        total: userCount,
        byRole: Object.fromEntries(
          usersByRole.map((u) => [u.role, u._count]),
        ),
      },
      orders: {
        total: orderCount,
      },
      trades: {
        total: tradeStats._count,
        totalVolume: tradeStats._sum.quantity || 0,
        totalAmount: tradeStats._sum.totalAmount || 0,
        averagePrice: tradeStats._avg.price || 0,
      },
      settlements: {
        completed: settlementStats._count,
        totalAmount: settlementStats._sum.amount || 0,
        totalFees: settlementStats._sum.fee || 0,
      },
    };
  }

  /**
   * 월별 거래 트렌드
   */
  async getMonthlyTrend(year: number) {
    const trades = await this.prisma.trade.findMany({
      where: {
        createdAt: {
          gte: new Date(year, 0, 1),
          lte: new Date(year, 11, 31, 23, 59, 59),
        },
      },
      select: {
        createdAt: true,
        quantity: true,
        totalAmount: true,
        energySource: true,
      },
    });

    const monthly = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      tradeCount: 0,
      totalVolume: 0,
      totalAmount: 0,
    }));

    for (const trade of trades) {
      const month = trade.createdAt.getMonth();
      monthly[month].tradeCount++;
      monthly[month].totalVolume += trade.quantity;
      monthly[month].totalAmount += trade.totalAmount;
    }

    return { year, monthly };
  }
}
