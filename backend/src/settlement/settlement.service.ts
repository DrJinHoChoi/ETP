import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettlementStatus, TradeStatus } from '@prisma/client';

const PLATFORM_FEE_RATE = 0.02; // 2% 수수료

@Injectable()
export class SettlementService {
  constructor(private readonly prisma: PrismaService) {}

  async createSettlement(tradeId: string) {
    const trade = await this.prisma.trade.findUnique({
      where: { id: tradeId },
    });
    if (!trade) {
      throw new NotFoundException('거래를 찾을 수 없습니다');
    }

    const fee = trade.totalAmount * PLATFORM_FEE_RATE;
    const netAmount = trade.totalAmount - fee;

    return this.prisma.settlement.create({
      data: {
        tradeId: trade.id,
        buyerId: trade.buyerId,
        sellerId: trade.sellerId,
        amount: trade.totalAmount,
        fee,
        netAmount,
      },
    });
  }

  async getSettlements(userId: string) {
    return this.prisma.settlement.findMany({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }],
      },
      include: {
        trade: {
          select: {
            id: true,
            energySource: true,
            quantity: true,
            price: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async confirmSettlement(settlementId: string) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
    });
    if (!settlement) {
      throw new NotFoundException('정산 내역을 찾을 수 없습니다');
    }

    return this.prisma.$transaction([
      this.prisma.settlement.update({
        where: { id: settlementId },
        data: {
          status: SettlementStatus.COMPLETED,
          settledAt: new Date(),
        },
      }),
      this.prisma.trade.update({
        where: { id: settlement.tradeId },
        data: { status: TradeStatus.SETTLED },
      }),
    ]);
  }

  async getSettlementStats(userId: string) {
    const stats = await this.prisma.settlement.aggregate({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }],
        status: SettlementStatus.COMPLETED,
      },
      _sum: { amount: true, fee: true, netAmount: true },
      _count: true,
    });

    return {
      totalSettled: stats._count,
      totalAmount: stats._sum.amount || 0,
      totalFee: stats._sum.fee || 0,
      totalNetAmount: stats._sum.netAmount || 0,
    };
  }
}
