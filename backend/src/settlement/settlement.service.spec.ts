import { Test, TestingModule } from '@nestjs/testing';
import { SettlementService } from './settlement.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../common/gateways/events.gateway';
import { NotFoundException } from '@nestjs/common';

describe('SettlementService', () => {
  let service: SettlementService;

  const mockPrisma = {
    trade: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    settlement: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockGateway = {
    emitSettlementCompleted: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventsGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<SettlementService>(SettlementService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSettlement', () => {
    const mockTrade = {
      id: 'trade-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      totalAmount: 10000,
      paymentCurrency: 'KRW',
      energySource: 'SOLAR',
      quantity: 100,
      price: 100,
    };

    it('should create a settlement from a trade', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(mockTrade);
      const settlement = {
        id: 'sett-1',
        tradeId: 'trade-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        amount: 10000,
        fee: 200,
        netAmount: 9800,
        paymentCurrency: 'KRW',
        epcPrice: null,
        status: 'PENDING',
      };
      mockPrisma.settlement.create.mockResolvedValue(settlement);

      const result = await service.createSettlement('trade-1');
      expect(result).toEqual(settlement);
      expect(mockPrisma.settlement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tradeId: 'trade-1',
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          fee: 200, // 2% of 10000
          netAmount: 9800,
        }),
      });
      expect(mockGateway.emitSettlementCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'created', tradeId: 'trade-1' }),
      );
    });

    it('should throw NotFoundException for invalid trade', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(null);

      await expect(service.createSettlement('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getSettlements', () => {
    it('should return settlements list for a user', async () => {
      const settlements = [
        { id: 'sett-1', tradeId: 'trade-1', status: 'PENDING' },
      ];
      mockPrisma.settlement.findMany.mockResolvedValue(settlements);

      const result = await service.getSettlements('user-1');
      expect(result).toEqual(settlements);
      expect(mockPrisma.settlement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ buyerId: 'user-1' }, { sellerId: 'user-1' }] },
        }),
      );
    });
  });

  describe('confirmSettlement', () => {
    it('should confirm a PENDING settlement', async () => {
      const settlement = { id: 'sett-1', tradeId: 'trade-1', status: 'PENDING' };
      mockPrisma.settlement.findUnique.mockResolvedValue(settlement);
      const updated = { ...settlement, status: 'COMPLETED', settledAt: new Date() };
      mockPrisma.$transaction.mockResolvedValue([updated, {}]);

      const result = await service.confirmSettlement('sett-1');
      expect(result).toEqual([updated]);
      expect(mockGateway.emitSettlementCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'confirmed', settlementId: 'sett-1' }),
      );
    });

    it('should throw NotFoundException for invalid settlement', async () => {
      mockPrisma.settlement.findUnique.mockResolvedValue(null);

      await expect(service.confirmSettlement('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw for non-PENDING settlement', async () => {
      const settlement = { id: 'sett-1', tradeId: 'trade-1', status: 'COMPLETED' };
      mockPrisma.settlement.findUnique.mockResolvedValue(settlement);

      await expect(service.confirmSettlement('sett-1')).rejects.toThrow();
    });
  });

  describe('getSettlementStats', () => {
    it('should return aggregated stats', async () => {
      mockPrisma.settlement.aggregate.mockResolvedValue({
        _count: 5,
        _sum: { amount: 50000, fee: 1000, netAmount: 49000 },
      });

      const result = await service.getSettlementStats('user-1');
      expect(result.totalSettled).toBe(5);
      expect(result.totalAmount).toBe(50000);
      expect(result.totalFee).toBe(1000);
      expect(result.totalNetAmount).toBe(49000);
    });

    it('should handle empty stats', async () => {
      mockPrisma.settlement.aggregate.mockResolvedValue({
        _count: 0,
        _sum: { amount: null, fee: null, netAmount: null },
      });

      const result = await service.getSettlementStats('user-1');
      expect(result.totalSettled).toBe(0);
      expect(result.totalAmount).toBe(0);
    });
  });
});
