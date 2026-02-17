import { Test, TestingModule } from '@nestjs/testing';
import { TradingService } from './trading.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../common/gateways/events.gateway';

describe('TradingService', () => {
  let service: TradingService;

  const mockPrisma = {
    order: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
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
});
