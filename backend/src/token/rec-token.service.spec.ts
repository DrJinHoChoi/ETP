import { Test, TestingModule } from '@nestjs/testing';
import { RECTokenService } from './rec-token.service';
import { PrismaService } from '../prisma/prisma.service';
import { EPCBlockchainService } from './epc-blockchain.service';
import { EventsGateway } from '../common/gateways/events.gateway';
import { TokenService } from './token.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('RECTokenService', () => {
  let service: RECTokenService;

  const mockPrisma = {
    rECToken: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    rECCertificate: {
      findUnique: jest.fn(),
    },
  };

  const mockBlockchain = {
    issueRECToken: jest.fn().mockResolvedValue('tx-hash-123'),
    transferRECToken: jest.fn().mockResolvedValue('tx-hash-456'),
    retireRECToken: jest.fn().mockResolvedValue('tx-hash-789'),
  };

  const mockGateway = {
    emitRECTokenUpdate: jest.fn(),
  };

  const mockTokenService = {
    transfer: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RECTokenService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EPCBlockchainService, useValue: mockBlockchain },
        { provide: EventsGateway, useValue: mockGateway },
        { provide: TokenService, useValue: mockTokenService },
      ],
    }).compile();

    service = module.get<RECTokenService>(RECTokenService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMarketplace', () => {
    it('should return active tokens', async () => {
      const tokens = [
        { id: 't1', status: 'ACTIVE', energySource: 'SOLAR', quantity: 100 },
      ];
      mockPrisma.rECToken.findMany.mockResolvedValue(tokens);

      const result = await service.getMarketplace();
      expect(result).toEqual(tokens);
      expect(mockPrisma.rECToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
    });

    it('should filter by energySource', async () => {
      mockPrisma.rECToken.findMany.mockResolvedValue([]);

      await service.getMarketplace({ energySource: 'WIND' as any });
      expect(mockPrisma.rECToken.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ energySource: 'WIND' }),
        }),
      );
    });
  });

  describe('getToken', () => {
    it('should return token by id', async () => {
      const token = { id: 't1', status: 'ACTIVE' };
      mockPrisma.rECToken.findUnique.mockResolvedValue(token);

      const result = await service.getToken('t1');
      expect(result).toEqual(token);
    });

    it('should throw NotFoundException for invalid token', async () => {
      mockPrisma.rECToken.findUnique.mockResolvedValue(null);

      await expect(service.getToken('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('retire', () => {
    it('should retire an ACTIVE token', async () => {
      const token = { id: 't1', ownerId: 'user-1', status: 'ACTIVE' };
      mockPrisma.rECToken.findUnique.mockResolvedValue(token);
      const retired = { ...token, status: 'RETIRED', retiredAt: new Date() };
      mockPrisma.rECToken.update.mockResolvedValue(retired);

      const result = await service.retire('t1', 'user-1');
      expect(result.status).toBe('RETIRED');
      expect(mockGateway.emitRECTokenUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'retired' }),
      );
    });

    it('should throw for non-owner', async () => {
      const token = { id: 't1', ownerId: 'user-1', status: 'ACTIVE' };
      mockPrisma.rECToken.findUnique.mockResolvedValue(token);

      await expect(service.retire('t1', 'other-user')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw for already retired token', async () => {
      const token = { id: 't1', ownerId: 'user-1', status: 'RETIRED' };
      mockPrisma.rECToken.findUnique.mockResolvedValue(token);

      await expect(service.retire('t1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── Phase 4 신규 테스트: 구매(Purchase) ───

  describe('purchaseToken', () => {
    const mockToken = {
      id: 'token-1',
      ownerId: 'seller-1',
      status: 'ACTIVE',
      energySource: 'SOLAR',
      quantity: 100,
      owner: { id: 'seller-1', name: 'Seller' },
    };

    it('should purchase a token with EPC', async () => {
      mockPrisma.rECToken.findUnique.mockResolvedValue(mockToken);
      const updated = { ...mockToken, ownerId: 'buyer-1' };
      mockPrisma.rECToken.update.mockResolvedValue(updated);

      const result = await service.purchaseToken('token-1', 'buyer-1', 50);
      expect(result.ownerId).toBe('buyer-1');
      expect(result.epcPaid).toBe(50);
      expect(result.previousOwnerId).toBe('seller-1');

      // EPC transfer: buyer → seller
      expect(mockTokenService.transfer).toHaveBeenCalledWith(
        'buyer-1',
        'seller-1',
        50,
        'rec-purchase',
        'token-1',
      );

      // Blockchain record
      expect(mockBlockchain.transferRECToken).toHaveBeenCalledWith(
        'token-1',
        'seller-1',
        'buyer-1',
      );

      // WebSocket notification
      expect(mockGateway.emitRECTokenUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'purchased',
          buyerId: 'buyer-1',
          previousOwnerId: 'seller-1',
          epcAmount: 50,
        }),
      );
    });

    it('should throw NotFoundException for invalid token', async () => {
      mockPrisma.rECToken.findUnique.mockResolvedValue(null);

      await expect(
        service.purchaseToken('invalid', 'buyer-1', 50),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for inactive token', async () => {
      mockPrisma.rECToken.findUnique.mockResolvedValue({
        ...mockToken,
        status: 'RETIRED',
      });

      await expect(
        service.purchaseToken('token-1', 'buyer-1', 50),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when buying own token', async () => {
      mockPrisma.rECToken.findUnique.mockResolvedValue(mockToken);

      await expect(
        service.purchaseToken('token-1', 'seller-1', 50),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for zero/negative EPC amount', async () => {
      mockPrisma.rECToken.findUnique.mockResolvedValue(mockToken);

      await expect(
        service.purchaseToken('token-1', 'buyer-1', 0),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.purchaseToken('token-1', 'buyer-1', -10),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate EPC transfer error', async () => {
      mockPrisma.rECToken.findUnique.mockResolvedValue(mockToken);
      mockTokenService.transfer.mockRejectedValueOnce(
        new BadRequestException('잔액 부족'),
      );

      await expect(
        service.purchaseToken('token-1', 'buyer-1', 9999),
      ).rejects.toThrow(BadRequestException);

      // Token should NOT be updated if EPC transfer fails
      expect(mockPrisma.rECToken.update).not.toHaveBeenCalled();
    });
  });

  describe('transfer', () => {
    it('should transfer token ownership', async () => {
      const token = { id: 't1', ownerId: 'user-1', status: 'ACTIVE' };
      mockPrisma.rECToken.findUnique.mockResolvedValue(token);
      const updated = { ...token, ownerId: 'user-2' };
      mockPrisma.rECToken.update.mockResolvedValue(updated);

      const result = await service.transfer('t1', 'user-1', 'user-2');
      expect(result.ownerId).toBe('user-2');
      expect(mockBlockchain.transferRECToken).toHaveBeenCalledWith('t1', 'user-1', 'user-2');
    });

    it('should throw for non-owner transfer', async () => {
      const token = { id: 't1', ownerId: 'user-1', status: 'ACTIVE' };
      mockPrisma.rECToken.findUnique.mockResolvedValue(token);

      await expect(service.transfer('t1', 'other-user', 'user-2')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
