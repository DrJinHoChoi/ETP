import { Test, TestingModule } from '@nestjs/testing';
import { OracleService } from './oracle.service';
import { PrismaService } from '../prisma/prisma.service';
import { EIAProvider } from './providers/eia.provider';
import { ENTSOEProvider } from './providers/entsoe.provider';
import { KPXProvider } from './providers/kpx.provider';
import { BlockchainService } from '../blockchain/blockchain.service';
import { EventsGateway } from '../common/gateways/events.gateway';
import { ConfigService } from '@nestjs/config';

describe('OracleService', () => {
  let service: OracleService;

  const mockPrisma = {
    priceOracle: { create: jest.fn() },
    priceBasket: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockGateway = {
    emitPriceUpdate: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn((key: string, defaultVal?: string) => {
      const config: Record<string, string> = {
        ORACLE_WEIGHT_EIA: '0.40',
        ORACLE_WEIGHT_ENTSOE: '0.35',
        ORACLE_WEIGHT_KPX: '0.25',
      };
      return config[key] ?? defaultVal;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OracleService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EIAProvider, useValue: { fetchPrice: jest.fn() } },
        { provide: ENTSOEProvider, useValue: { fetchPrice: jest.fn() } },
        { provide: KPXProvider, useValue: { fetchPrice: jest.fn() } },
        { provide: BlockchainService, useValue: { submitTransaction: jest.fn() } },
        { provide: EventsGateway, useValue: mockGateway },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<OracleService>(OracleService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getLatestBasketPrice', () => {
    it('should return latest basket price', async () => {
      const basket = {
        id: '1',
        weightedAvgPrice: 0.085,
        eiaPrice: 0.08,
        entsoePrice: 0.09,
        kpxPrice: 0.085,
        isStale: false,
        timestamp: new Date(),
      };
      mockPrisma.priceBasket.findFirst.mockResolvedValue(basket);

      const result = await service.getLatestBasketPrice();
      expect(result).toEqual(basket);
    });

    it('should return null if no basket exists', async () => {
      mockPrisma.priceBasket.findFirst.mockResolvedValue(null);

      const result = await service.getLatestBasketPrice();
      expect(result).toBeNull();
    });
  });

  describe('getBasketHistory', () => {
    it('should return basket history', async () => {
      const baskets = [
        { id: '1', weightedAvgPrice: 0.085, timestamp: new Date() },
      ];
      mockPrisma.priceBasket.findMany.mockResolvedValue(baskets);

      const result = await service.getBasketHistory();
      expect(result).toEqual(baskets);
    });
  });
});
