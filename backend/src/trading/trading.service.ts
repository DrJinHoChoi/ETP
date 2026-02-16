import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, OrderType, TradeStatus } from '@prisma/client';

@Injectable()
export class TradingService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(userId: string, dto: CreateOrderDto) {
    const order = await this.prisma.order.create({
      data: {
        userId,
        type: dto.type,
        energySource: dto.energySource,
        quantity: dto.quantity,
        price: dto.price,
        remainingQty: dto.quantity,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
      },
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
    return this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.CANCELLED },
    });
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

      await this.prisma.$transaction([
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

      remainingQty -= tradeQty;
    }

    // 원래 주문 업데이트
    await this.prisma.order.update({
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
  }
}
