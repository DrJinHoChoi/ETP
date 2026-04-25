import { Test, TestingModule } from '@nestjs/testing';
import { TokenService } from './token.service';
import { PrismaService } from '../prisma/prisma.service';
import { EPCBlockchainService } from './epc-blockchain.service';
import { OracleService } from '../oracle/oracle.service';
import { EventsGateway } from '../common/gateways/events.gateway';

describe('TokenService', () => {
  let service: TokenService;

  const mockPrisma = {
    tokenBalance: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    tokenTransaction: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockGateway = {
    emitTokenBalanceUpdate: jest.fn(),
  };

  const mockEpcBlockchain = {
    mint: jest.fn(),
    burn: jest.fn(),
    transfer: jest.fn(),
    lock: jest.fn(),
    unlock: jest.fn(),
  };

  const mockOracleService = {
    getLatestBasketPrice: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EPCBlockchainService, useValue: mockEpcBlockchain },
        { provide: OracleService, useValue: mockOracleService },
        { provide: EventsGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrCreateWallet', () => {
    it('should return existing wallet', async () => {
      const wallet = { id: '1', userId: 'u1', balance: 100, lockedBalance: 20 };
      mockPrisma.tokenBalance.findUnique.mockResolvedValue(wallet);

      const result = await service.getOrCreateWallet('u1');
      expect(result).toEqual(wallet);
    });

    it('should create wallet if not exists', async () => {
      const wallet = { id: '1', userId: 'u1', balance: 0, lockedBalance: 0 };
      mockPrisma.tokenBalance.findUnique.mockResolvedValue(null);
      mockPrisma.tokenBalance.create.mockResolvedValue(wallet);

      const result = await service.getOrCreateWallet('u1');
      expect(result).toEqual(wallet);
      expect(mockPrisma.tokenBalance.create).toHaveBeenCalledWith({
        data: { userId: 'u1', balance: 0, lockedBalance: 0 },
      });
    });
  });

  describe('getBalance', () => {
    it('should return balance info', async () => {
      const wallet = { id: '1', userId: 'u1', balance: 100, lockedBalance: 20 };
      mockPrisma.tokenBalance.findUnique.mockResolvedValue(wallet);

      const result = await service.getBalance('u1');
      expect(result.balance).toBe(100);
      expect(result.lockedBalance).toBe(20);
      expect(result.availableBalance).toBe(80);
    });
  });

  describe('getTransactions', () => {
    it('should return user transactions', async () => {
      const txs = [
        { id: 't1', type: 'MINT', amount: 50, createdAt: new Date() },
      ];
      mockPrisma.tokenTransaction.findMany.mockResolvedValue(txs);

      const result = await service.getTransactions('u1');
      expect(result).toEqual(txs);
    });
  });
});
