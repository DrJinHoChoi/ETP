import { Injectable, NotFoundException, Inject, Optional, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentCurrency, SettlementStatus, TradeStatus } from '@prisma/client';
import { TokenService } from '../token/token.service';
import { OracleService } from '../oracle/oracle.service';
import { EventsGateway } from '../common/gateways/events.gateway';

const PLATFORM_FEE_RATE = 0.02; // 2% 수수료

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    @Optional() @Inject(TokenService) private readonly tokenService?: TokenService,
    @Optional() @Inject(OracleService) private readonly oracleService?: OracleService,
  ) {}

  async createSettlement(tradeId: string) {
    const trade = await this.prisma.trade.findUnique({
      where: { id: tradeId },
    });
    if (!trade) {
      throw new NotFoundException('거래를 찾을 수 없습니다');
    }

    const fee = trade.totalAmount * PLATFORM_FEE_RATE;
    const netAmount = trade.totalAmount - fee;

    // EPC 정산: buyer→seller 이체 + 수수료 소각
    if (trade.paymentCurrency === PaymentCurrency.EPC && this.tokenService) {
      try {
        await this.tokenService.transfer(
          trade.buyerId,
          trade.sellerId,
          netAmount,
          'settlement',
          tradeId,
        );
        await this.tokenService.burnForSettlement(trade.buyerId, fee, tradeId);
      } catch (error) {
        this.logger.error(`EPC 정산 처리 실패 (거래 ${tradeId}): ${error.message}`);
        // 정산 실패 시 FAILED 상태로 기록
        const failedSettlement = await this.prisma.settlement.create({
          data: {
            tradeId: trade.id,
            buyerId: trade.buyerId,
            sellerId: trade.sellerId,
            amount: trade.totalAmount,
            fee,
            netAmount,
            paymentCurrency: trade.paymentCurrency,
            epcPrice: null,
            status: SettlementStatus.FAILED,
          },
        });
        this.eventsGateway.emitSettlementCompleted({
          action: 'failed',
          settlementId: failedSettlement.id,
          tradeId,
          reason: error.message,
        });
        throw error;
      }
    }

    let epcPrice: number | null = null;
    if (trade.paymentCurrency === PaymentCurrency.EPC && this.oracleService) {
      try {
        const basket = await this.oracleService.getLatestBasketPrice();
        epcPrice = basket?.weightedAvgPrice ?? null;
      } catch {
        this.logger.warn('바스켓 가격 조회 실패 - epcPrice null로 설정');
      }
    }

    const settlement = await this.prisma.settlement.create({
      data: {
        tradeId: trade.id,
        buyerId: trade.buyerId,
        sellerId: trade.sellerId,
        amount: trade.totalAmount,
        fee,
        netAmount,
        paymentCurrency: trade.paymentCurrency,
        epcPrice,
      },
    });

    this.eventsGateway.emitSettlementCompleted({
      action: 'created',
      settlementId: settlement.id,
      tradeId,
      amount: trade.totalAmount,
      fee,
      netAmount,
      paymentCurrency: trade.paymentCurrency,
    });

    return settlement;
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
    if (settlement.status !== SettlementStatus.PENDING) {
      throw new NotFoundException('대기 상태의 정산만 확인할 수 있습니다');
    }

    const [updatedSettlement] = await this.prisma.$transaction([
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

    this.eventsGateway.emitSettlementCompleted({
      action: 'confirmed',
      settlementId: updatedSettlement.id,
      tradeId: settlement.tradeId,
      status: 'COMPLETED',
    });

    return [updatedSettlement];
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
