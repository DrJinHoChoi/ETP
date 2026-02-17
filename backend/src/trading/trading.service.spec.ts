import { Test, TestingModule } from '@nestjs/testing';
import { TradingService } from './trading.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../common/gateways/events.gateway';
import { NotFoundException } from '@nestjs/common';

describe('TradingService', () => {
  let service: TradingService;

  const mockPrisma = {
    order: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    trade: {
      create: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockGateway = {
    emitTradeMatched: jest.fn(),
    emitOrderUpdated: jest.fn(),
    emitStatsUpdate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventsGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<TradingService>(TradingService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrders', () => {
    it('should return orders list', async () => {
      const orders = [
        { id: '1', type: 'BUY', status: 'PENDING', quantity: 100 },
      ];
      mockPrisma.order.findMany.mockResolvedValue(orders);

      const result = await service.getOrders({});
      expect(result).toEqual(orders);
    });
  });

  describe('getOrderById', () => {
    it('should return order by id', async () => {
      const order = { id: '1', type: 'BUY', status: 'PENDING' };
      mockPrisma.order.findUnique.mockResolvedValue(order);

      const result = await service.getOrderById('1');
      expect(result).toEqual(order);
    });

    it('should throw NotFoundException for invalid id', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(service.getOrderById('invalid')).rejects.toThrow();
    });
  });

  describe('getTradingStats', () => {
    it('should return aggregated stats', async () => {
      mockPrisma.trade.aggregate.mockResolvedValue({
        _count: 10,
        _sum: { quantity: 5000, totalAmount: 500000 },
        _avg: { price: 100 },
      });

      const result = await service.getTradingStats();
      expect(result.totalTrades).toBe(10);
      expect(result.totalVolume).toBe(5000);
    });
  });

  // ─── Phase 4 신규 테스트: Admin 기능 ───

  describe('getAdminOrders', () => {
    it('should return all orders without filter', async () => {
      const orders = [
        { id: '1', type: 'BUY', status: 'PENDING', user: { id: 'u1', name: 'User1' } },
        { id: '2', type: 'SELL', status: 'FILLED', user: { id: 'u2', name: 'User2' } },
      ];
      mockPrisma.order.findMany.mockResolvedValue(orders);

      const result = await service.getAdminOrders();
      expect(result).toEqual(orders);
      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 200,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should filter orders by status', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);

      await service.getAdminOrders({ status: 'PENDING' as any });
      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
    });

    it('should filter orders by type', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);

      await service.getAdminOrders({ type: 'BUY' as any });
      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'BUY' }),
        }),
      );
    });
  });

  describe('adminCancelOrder', () => {
    it('should cancel a PENDING order', async () => {
      const order = {
        id: 'order-1',
        type: 'BUY',
        status: 'PENDING',
        paymentCurrency: 'KRW',
        remainingQty: 100,
        price: 50,
        userId: 'user-1',
      };
      mockPrisma.order.findUnique.mockResolvedValue(order);
      const cancelled = { ...order, status: 'CANCELLED' };
      mockPrisma.order.update.mockResolvedValue(cancelled);

      const result = await service.adminCancelOrder('order-1');
      expect(result.status).toBe('CANCELLED');
      expect(mockGateway.emitOrderUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'admin-cancelled' }),
      );
    });

    it('should cancel a PARTIALLY_FILLED order', async () => {
      const order = {
        id: 'order-2',
        type: 'SELL',
        status: 'PARTIALLY_FILLED',
        paymentCurrency: 'KRW',
        remainingQty: 50,
        price: 100,
        userId: 'user-2',
      };
      mockPrisma.order.findUnique.mockResolvedValue(order);
      const cancelled = { ...order, status: 'CANCELLED' };
      mockPrisma.order.update.mockResolvedValue(cancelled);

      const result = await service.adminCancelOrder('order-2');
      expect(result.status).toBe('CANCELLED');
    });

    it('should throw NotFoundException for invalid order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(service.adminCancelOrder('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw for already cancelled order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: 'CANCELLED',
      });

      await expect(service.adminCancelOrder('order-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw for expired order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: 'EXPIRED',
      });

      await expect(service.adminCancelOrder('order-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
