import { Test, TestingModule } from '@nestjs/testing';
import { SettlementService } from './settlement.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../common/gateways/events.gateway';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('SettlementService', () => {
  let service: SettlementService;

  const mockPrisma = {
    trade: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
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

  // ─── Phase 4 신규 테스트: 분쟁(Dispute) ───

  describe('createDispute', () => {
    const mockTrade = {
      id: 'trade-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      status: 'MATCHED',
      paymentCurrency: 'KRW',
      settlement: null,
    };

    it('should create a dispute for a trade', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(mockTrade);
      mockPrisma.$transaction.mockResolvedValue([{}]);

      const result = await service.createDispute('trade-1', 'buyer-1', '품질 문제');
      expect(result.tradeId).toBe('trade-1');
      expect(result.status).toBe('DISPUTED');
      expect(result.reason).toBe('품질 문제');
      expect(result.disputedBy).toBe('buyer-1');
      expect(mockGateway.emitSettlementCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'disputed', tradeId: 'trade-1' }),
      );
    });

    it('should freeze settlement when dispute is created', async () => {
      const tradeWithSettlement = {
        ...mockTrade,
        settlement: { id: 'sett-1', status: 'PENDING' },
      };
      mockPrisma.trade.findUnique.mockResolvedValue(tradeWithSettlement);
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      await service.createDispute('trade-1', 'buyer-1', '배송 지연');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException for invalid trade', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(null);

      await expect(
        service.createDispute('invalid', 'user-1', 'reason'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for non-party user', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(mockTrade);

      await expect(
        service.createDispute('trade-1', 'other-user', 'reason'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for already disputed trade', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue({
        ...mockTrade,
        status: 'DISPUTED',
      });

      await expect(
        service.createDispute('trade-1', 'buyer-1', 'reason'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for cancelled trade', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue({
        ...mockTrade,
        status: 'CANCELLED',
      });

      await expect(
        service.createDispute('trade-1', 'buyer-1', 'reason'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resolveDispute', () => {
    const disputedTrade = {
      id: 'trade-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      status: 'DISPUTED',
      paymentCurrency: 'KRW',
      settlement: { id: 'sett-1', status: 'PROCESSING', netAmount: 9800 },
    };

    it('should resolve dispute with COMPLETE', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(disputedTrade);
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await service.resolveDispute('trade-1', 'admin-1', 'COMPLETE');
      expect(result.tradeId).toBe('trade-1');
      expect(result.resolution).toBe('COMPLETE');
      expect(result.tradeStatus).toBe('SETTLED');
      expect(result.settlementStatus).toBe('COMPLETED');
      expect(result.resolvedBy).toBe('admin-1');
      expect(mockGateway.emitSettlementCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'dispute-resolved', resolution: 'COMPLETE' }),
      );
    });

    it('should resolve dispute with CANCEL', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(disputedTrade);
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await service.resolveDispute('trade-1', 'admin-1', 'CANCEL');
      expect(result.tradeStatus).toBe('CANCELLED');
      expect(result.settlementStatus).toBe('FAILED');
    });

    it('should resolve dispute with REFUND (KRW trade)', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(disputedTrade);
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await service.resolveDispute('trade-1', 'admin-1', 'REFUND');
      expect(result.tradeStatus).toBe('CANCELLED');
      expect(result.settlementStatus).toBe('FAILED');
    });

    it('should throw NotFoundException for invalid trade', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(null);

      await expect(
        service.resolveDispute('invalid', 'admin-1', 'COMPLETE'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for non-disputed trade', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue({
        ...disputedTrade,
        status: 'MATCHED',
      });

      await expect(
        service.resolveDispute('trade-1', 'admin-1', 'COMPLETE'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDisputes', () => {
    it('should return disputed trades list', async () => {
      const disputes = [
        { id: 'trade-1', status: 'DISPUTED', buyer: {}, seller: {} },
      ];
      mockPrisma.trade.findMany.mockResolvedValue(disputes);

      const result = await service.getDisputes();
      expect(result).toEqual(disputes);
      expect(mockPrisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'DISPUTED' },
        }),
      );
    });
  });
});
