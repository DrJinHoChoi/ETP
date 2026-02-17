import { Injectable, NotFoundException, BadRequestException, Inject, Optional, Logger } from '@nestjs/common';
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

  // ─── 분쟁(Dispute) 관련 ───

  /** 분쟁 제기 — 거래 당사자가 호출 */
  async createDispute(tradeId: string, userId: string, reason: string) {
    const trade = await this.prisma.trade.findUnique({
      where: { id: tradeId },
      include: { settlement: true },
    });
    if (!trade) {
      throw new NotFoundException('거래를 찾을 수 없습니다');
    }

    // 거래 당사자인지 확인
    if (trade.buyerId !== userId && trade.sellerId !== userId) {
      throw new BadRequestException('거래 당사자만 분쟁을 제기할 수 있습니다');
    }

    // 이미 분쟁 상태인지 확인
    if (trade.status === TradeStatus.DISPUTED) {
      throw new BadRequestException('이미 분쟁 중인 거래입니다');
    }

    // CANCELLED이거나 이미 SETTLED가 아닌 상태 체크
    if (trade.status === TradeStatus.CANCELLED) {
      throw new BadRequestException('취소된 거래는 분쟁을 제기할 수 없습니다');
    }

    const operations: any[] = [
      this.prisma.trade.update({
        where: { id: tradeId },
        data: { status: TradeStatus.DISPUTED },
      }),
    ];

    // 정산이 있으면 PROCESSING으로 변경 (동결)
    if (trade.settlement) {
      operations.push(
        this.prisma.settlement.update({
          where: { id: trade.settlement.id },
          data: { status: SettlementStatus.PROCESSING },
        }),
      );
    }

    await this.prisma.$transaction(operations);

    this.logger.warn(`분쟁 제기: 거래 ${tradeId}, 사유: ${reason}, 제기자: ${userId}`);

    this.eventsGateway.emitSettlementCompleted({
      action: 'disputed',
      tradeId,
      reason,
      disputedBy: userId,
    });

    return {
      tradeId,
      status: TradeStatus.DISPUTED,
      reason,
      disputedBy: userId,
    };
  }

  /** 분쟁 해결 — Admin만 호출 */
  async resolveDispute(
    tradeId: string,
    adminId: string,
    resolution: 'REFUND' | 'COMPLETE' | 'CANCEL',
  ) {
    const trade = await this.prisma.trade.findUnique({
      where: { id: tradeId },
      include: { settlement: true },
    });
    if (!trade) {
      throw new NotFoundException('거래를 찾을 수 없습니다');
    }
    if (trade.status !== TradeStatus.DISPUTED) {
      throw new BadRequestException('분쟁 상태의 거래만 해결할 수 있습니다');
    }

    let newTradeStatus: TradeStatus;
    let newSettlementStatus: SettlementStatus | null = null;

    switch (resolution) {
      case 'REFUND':
        // EPC 거래인 경우 환불 처리
        if (trade.paymentCurrency === PaymentCurrency.EPC && this.tokenService && trade.settlement) {
          try {
            // seller → buyer 환불
            await this.tokenService.transfer(
              trade.sellerId,
              trade.buyerId,
              trade.settlement.netAmount,
              'dispute-refund',
              tradeId,
            );
          } catch (error) {
            this.logger.error(`환불 처리 실패 (거래 ${tradeId}): ${error.message}`);
          }
        }
        newTradeStatus = TradeStatus.CANCELLED;
        newSettlementStatus = SettlementStatus.FAILED;
        break;

      case 'COMPLETE':
        newTradeStatus = TradeStatus.SETTLED;
        newSettlementStatus = SettlementStatus.COMPLETED;
        break;

      case 'CANCEL':
        newTradeStatus = TradeStatus.CANCELLED;
        newSettlementStatus = SettlementStatus.FAILED;
        break;

      default:
        throw new BadRequestException('유효하지 않은 해결 방법입니다');
    }

    const operations: any[] = [
      this.prisma.trade.update({
        where: { id: tradeId },
        data: { status: newTradeStatus },
      }),
    ];

    if (trade.settlement && newSettlementStatus) {
      operations.push(
        this.prisma.settlement.update({
          where: { id: trade.settlement.id },
          data: {
            status: newSettlementStatus,
            ...(newSettlementStatus === SettlementStatus.COMPLETED && { settledAt: new Date() }),
          },
        }),
      );
    }

    await this.prisma.$transaction(operations);

    this.logger.log(`분쟁 해결: 거래 ${tradeId}, 결과: ${resolution}, 관리자: ${adminId}`);

    this.eventsGateway.emitSettlementCompleted({
      action: 'dispute-resolved',
      tradeId,
      resolution,
      resolvedBy: adminId,
      newTradeStatus,
    });

    return {
      tradeId,
      resolution,
      tradeStatus: newTradeStatus,
      settlementStatus: newSettlementStatus,
      resolvedBy: adminId,
    };
  }

  /** 분쟁 목록 조회 (Admin) */
  async getDisputes() {
    return this.prisma.trade.findMany({
      where: { status: TradeStatus.DISPUTED },
      include: {
        buyer: { select: { id: true, name: true, email: true, organization: true } },
        seller: { select: { id: true, name: true, email: true, organization: true } },
        settlement: true,
        buyOrder: { select: { id: true, type: true, energySource: true, quantity: true, price: true } },
        sellOrder: { select: { id: true, type: true, energySource: true, quantity: true, price: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
