import { Injectable, NotFoundException, Inject, Optional, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, OrderType, PaymentCurrency, TradeStatus } from '@prisma/client';
import { TokenService } from '../token/token.service';
import { EventsGateway } from '../common/gateways/events.gateway';

@Injectable()
export class TradingService {
  private readonly logger = new Logger(TradingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    @Optional() @Inject(TokenService) private readonly tokenService?: TokenService,
  ) {}

  async createOrder(userId: string, dto: CreateOrderDto) {
    const paymentCurrency = dto.paymentCurrency || PaymentCurrency.KRW;

    const order = await this.prisma.order.create({
      data: {
        userId,
        type: dto.type,
        energySource: dto.energySource,
        quantity: dto.quantity,
        price: dto.price,
        remainingQty: dto.quantity,
        paymentCurrency,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
      },
    });

    // EPC 매수 주문: 필요 EPC 잠금
    if (
      paymentCurrency === PaymentCurrency.EPC &&
      dto.type === OrderType.BUY &&
      this.tokenService
    ) {
      const requiredEPC = dto.quantity * dto.price;
      try {
        await this.tokenService.lockForTrade(userId, requiredEPC, order.id);
      } catch (error) {
        // 잠금 실패 시 주문 취소 (보상 트랜잭션)
        await this.prisma.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.CANCELLED },
        });
        this.logger.error(`EPC 잠금 실패로 주문 취소 (${order.id}): ${error.message}`);
        throw error;
      }
    }

    this.eventsGateway.emitOrderUpdated({
      action: 'created',
      order: { id: order.id, type: order.type, status: order.status },
    });

    // 자동 매칭 시도
    await this.tryMatch(order.id);

    return order;
  }

  async getOrders(filters?: {
    type?: OrderType;
    status?: OrderStatus;
    userId?: string;
  }) {
    return this.prisma.order.findMany({
      where: {
        type: filters?.type,
        status: filters?.status,
        userId: filters?.userId,
      },
      include: {
        user: { select: { id: true, name: true, organization: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrderById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, organization: true } },
        buyTrades: true,
        sellTrades: true,
      },
    });
    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }
    return order;
  }

  async cancelOrder(id: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId, status: OrderStatus.PENDING },
    });
    if (!order) {
      throw new NotFoundException('취소 가능한 주문을 찾을 수 없습니다');
    }
    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.CANCELLED },
    });

    // EPC 매수 주문 취소: 잠금 해제
    if (
      order.paymentCurrency === PaymentCurrency.EPC &&
      order.type === OrderType.BUY &&
      this.tokenService
    ) {
      const lockedAmount = order.remainingQty * order.price;
      try {
        await this.tokenService.unlockFromCancelledTrade(userId, lockedAmount, id);
      } catch (error) {
        this.logger.error(`EPC 잠금 해제 실패 (주문 ${id}): ${error.message}`);
      }
    }

    this.eventsGateway.emitOrderUpdated({
      action: 'cancelled',
      order: { id: updated.id, type: updated.type, status: updated.status },
    });

    return updated;
  }

  async getTrades(userId?: string) {
    return this.prisma.trade.findMany({
      where: userId
        ? { OR: [{ buyerId: userId }, { sellerId: userId }] }
        : undefined,
      include: {
        buyer: { select: { id: true, name: true, organization: true } },
        seller: { select: { id: true, name: true, organization: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTradingStats() {
    const [totalTrades, todayTrades] = await Promise.all([
      this.prisma.trade.aggregate({
        _count: true,
        _sum: { quantity: true, totalAmount: true },
        _avg: { price: true },
      }),
      this.prisma.trade.aggregate({
        _count: true,
        _sum: { quantity: true },
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    return {
      totalVolume: totalTrades._sum.quantity || 0,
      totalTrades: totalTrades._count,
      totalAmount: totalTrades._sum.totalAmount || 0,
      averagePrice: totalTrades._avg.price || 0,
      todayVolume: todayTrades._sum.quantity || 0,
      todayTrades: todayTrades._count,
    };
  }

  /**
   * 가격 우선, 시간 우선으로 매칭을 시도한다.
   * 매수 주문: 가장 낮은 가격의 매도 주문과 매칭
   * 매도 주문: 가장 높은 가격의 매수 주문과 매칭
   */
  private async tryMatch(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order || order.remainingQty <= 0) return;

    const oppositeType =
      order.type === OrderType.BUY ? OrderType.SELL : OrderType.BUY;
    const priceCondition =
      order.type === OrderType.BUY
        ? { lte: order.price }
        : { gte: order.price };

    const matchingOrders = await this.prisma.order.findMany({
      where: {
        type: oppositeType,
        energySource: order.energySource,
        paymentCurrency: order.paymentCurrency,
        status: { in: [OrderStatus.PENDING, OrderStatus.PARTIALLY_FILLED] },
        remainingQty: { gt: 0 },
        price: priceCondition,
        userId: { not: order.userId },
      },
      orderBy: [
        { price: order.type === OrderType.BUY ? 'asc' : 'desc' },
        { createdAt: 'asc' },
      ],
    });

    let remainingQty = order.remainingQty;

    for (const match of matchingOrders) {
      if (remainingQty <= 0) break;

      const tradeQty = Math.min(remainingQty, match.remainingQty);
      const tradePrice =
        order.type === OrderType.BUY ? match.price : order.price;

      const [buyOrderId, sellOrderId, buyerId, sellerId] =
        order.type === OrderType.BUY
          ? [order.id, match.id, order.userId, match.userId]
          : [match.id, order.id, match.userId, order.userId];

      try {
        const [trade] = await this.prisma.$transaction([
          this.prisma.trade.create({
            data: {
              buyOrderId,
              sellOrderId,
              buyerId,
              sellerId,
              energySource: order.energySource,
              quantity: tradeQty,
              price: tradePrice,
              totalAmount: tradeQty * tradePrice,
              paymentCurrency: order.paymentCurrency,
              status: TradeStatus.MATCHED,
            },
          }),
          this.prisma.order.update({
            where: { id: match.id },
            data: {
              remainingQty: match.remainingQty - tradeQty,
              status:
                match.remainingQty - tradeQty <= 0
                  ? OrderStatus.FILLED
                  : OrderStatus.PARTIALLY_FILLED,
            },
          }),
        ]);

        // WebSocket: 거래 체결 알림
        this.eventsGateway.emitTradeMatched({
          tradeId: trade.id,
          buyerId,
          sellerId,
          energySource: order.energySource,
          quantity: tradeQty,
          price: tradePrice,
          totalAmount: tradeQty * tradePrice,
          paymentCurrency: order.paymentCurrency,
        });

        this.logger.log(
          `거래 체결: ${tradeQty} kWh @ ${tradePrice} ${order.paymentCurrency} (${order.energySource})`,
        );
      } catch (error) {
        this.logger.error(`매칭 트랜잭션 실패 (주문 ${match.id}): ${error.message}`);
        continue;
      }

      remainingQty -= tradeQty;
    }

    // 원래 주문 업데이트
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        remainingQty,
        status:
          remainingQty <= 0
            ? OrderStatus.FILLED
            : remainingQty < order.quantity
              ? OrderStatus.PARTIALLY_FILLED
              : OrderStatus.PENDING,
      },
    });

    // 주문 상태가 변경되었으면 이벤트 발행
    if (updatedOrder.status !== order.status) {
      this.eventsGateway.emitOrderUpdated({
        action: 'status_changed',
        order: {
          id: updatedOrder.id,
          type: updatedOrder.type,
          status: updatedOrder.status,
          remainingQty: updatedOrder.remainingQty,
        },
      });
    }
  }

  /**
   * 만료된 주문 자동 처리 (매분 실행)
   * validUntil이 지난 PENDING/PARTIALLY_FILLED 주문을 EXPIRED로 변경하고
   * EPC 매수 주문의 잠금을 해제한다.
   */
  @Cron('* * * * *')
  async expireStaleOrders() {
    const now = new Date();

    const expiredOrders = await this.prisma.order.findMany({
      where: {
        validUntil: { lt: now },
        status: { in: [OrderStatus.PENDING, OrderStatus.PARTIALLY_FILLED] },
      },
    });

    if (expiredOrders.length === 0) return;

    this.logger.log(`만료 주문 처리 시작: ${expiredOrders.length}건`);

    for (const order of expiredOrders) {
      try {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.EXPIRED },
        });

        // EPC 매수 주문: 잔여 잠금 해제
        if (
          order.paymentCurrency === PaymentCurrency.EPC &&
          order.type === OrderType.BUY &&
          order.remainingQty > 0 &&
          this.tokenService
        ) {
          const lockedAmount = order.remainingQty * order.price;
          try {
            await this.tokenService.unlockFromCancelledTrade(
              order.userId,
              lockedAmount,
              order.id,
            );
          } catch (unlockError) {
            this.logger.error(
              `만료 주문 EPC 잠금 해제 실패 (${order.id}): ${(unlockError as Error).message}`,
            );
          }
        }

        this.eventsGateway.emitOrderUpdated({
          action: 'expired',
          order: { id: order.id, type: order.type, status: OrderStatus.EXPIRED },
        });
      } catch (error) {
        this.logger.error(`주문 만료 처리 실패 (${order.id}): ${(error as Error).message}`);
      }
    }

    this.logger.log(`만료 주문 처리 완료: ${expiredOrders.length}건`);
  }

  /** 최근 체결 내역 (대시보드 피드용) */
  async getRecentTrades(limit = 10) {
    const trades = await this.prisma.trade.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        buyer: { select: { organization: true } },
        seller: { select: { organization: true } },
      },
    });

    return trades.map((t) => ({
      id: t.id,
      energySource: t.energySource,
      quantity: t.quantity,
      price: t.price,
      totalAmount: t.totalAmount,
      paymentCurrency: t.paymentCurrency,
      buyerOrg: t.buyer.organization,
      sellerOrg: t.seller.organization,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  // ─── Admin 기능 ───

  /** 전체 주문 조회 (Admin) */
  async getAdminOrders(filters?: {
    status?: OrderStatus;
    type?: OrderType;
  }) {
    return this.prisma.order.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.type && { type: filters.type }),
      },
      include: {
        user: { select: { id: true, name: true, email: true, organization: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  /** 관리자 주문 강제 취소 */
  async adminCancelOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }
    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.EXPIRED) {
      throw new NotFoundException('이미 취소/만료된 주문입니다');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
    });

    // EPC 매수 주문: 잔여 잠금 해제
    if (
      order.paymentCurrency === PaymentCurrency.EPC &&
      order.type === OrderType.BUY &&
      order.remainingQty > 0 &&
      this.tokenService
    ) {
      const lockedAmount = order.remainingQty * order.price;
      try {
        await this.tokenService.unlockFromCancelledTrade(order.userId, lockedAmount, orderId);
      } catch (error) {
        this.logger.error(`관리자 취소 EPC 잠금 해제 실패 (${orderId}): ${(error as Error).message}`);
      }
    }

    this.eventsGateway.emitOrderUpdated({
      action: 'admin-cancelled',
      order: { id: updated.id, type: updated.type, status: updated.status },
    });

    this.logger.warn(`관리자 주문 강제 취소: ${orderId}`);
    return updated;
  }
}
