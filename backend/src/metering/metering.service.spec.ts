import { Test, TestingModule } from '@nestjs/testing';
import { MeteringService } from './metering.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../common/gateways/events.gateway';

describe('MeteringService', () => {
  let service: MeteringService;

  const mockPrisma = {
    meterReading: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockGateway = {
    emitMeterReading: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeteringService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventsGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<MeteringService>(MeteringService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createReading', () => {
    const dto = {
      production: 150,
      consumption: 80,
      source: 'SOLAR' as const,
      deviceId: 'METER-001',
      timestamp: '2024-01-15T10:00:00.000Z',
    };

    it('should create a meter reading', async () => {
      const reading = {
        id: 'reading-1',
        userId: 'user-1',
        production: 150,
        consumption: 80,
        source: 'SOLAR',
        deviceId: 'METER-001',
        timestamp: new Date('2024-01-15T10:00:00.000Z'),
      };
      mockPrisma.meterReading.create.mockResolvedValue(reading);

      const result = await service.createReading('user-1', dto);
      expect(result).toEqual(reading);
      expect(mockPrisma.meterReading.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          production: 150,
          consumption: 80,
          source: 'SOLAR',
          deviceId: 'METER-001',
        }),
      });
    });

    it('should emit WebSocket event after creation', async () => {
      const reading = {
        id: 'reading-1',
        userId: 'user-1',
        production: 150,
        consumption: 80,
        source: 'SOLAR',
        deviceId: 'METER-001',
        timestamp: new Date('2024-01-15T10:00:00.000Z'),
      };
      mockPrisma.meterReading.create.mockResolvedValue(reading);

      await service.createReading('user-1', dto);
      expect(mockGateway.emitMeterReading).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'reading-1',
          userId: 'user-1',
          production: 150,
          consumption: 80,
          netEnergy: 70, // 150 - 80
        }),
      );
    });
  });

  describe('getReadings', () => {
    it('should return readings list for a user', async () => {
      const readings = [
        { id: 'r1', production: 100, consumption: 50, source: 'SOLAR' },
        { id: 'r2', production: 200, consumption: 80, source: 'WIND' },
      ];
      mockPrisma.meterReading.findMany.mockResolvedValue(readings);

      const result = await service.getReadings('user-1');
      expect(result).toEqual(readings);
      expect(mockPrisma.meterReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1' }),
        }),
      );
    });

    it('should filter by date range', async () => {
      mockPrisma.meterReading.findMany.mockResolvedValue([]);

      await service.getReadings('user-1', {
        from: '2024-01-01',
        to: '2024-01-31',
      });

      expect(mockPrisma.meterReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            timestamp: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          }),
        }),
      );
    });

    it('should filter by deviceId', async () => {
      mockPrisma.meterReading.findMany.mockResolvedValue([]);

      await service.getReadings('user-1', { deviceId: 'METER-001' });

      expect(mockPrisma.meterReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            deviceId: 'METER-001',
          }),
        }),
      );
    });
  });

  describe('getAggregation', () => {
    it('should return aggregated data for a period', async () => {
      const readings = [
        { production: 100, consumption: 40 },
        { production: 200, consumption: 60 },
      ];
      mockPrisma.meterReading.findMany.mockResolvedValue(readings);

      const result = await service.getAggregation(
        'user-1',
        'DAILY',
        '2024-01-01',
        '2024-01-31',
      );

      expect(result.totalProduction).toBe(300);
      expect(result.totalConsumption).toBe(100);
      expect(result.netEnergy).toBe(200);
      expect(result.readingCount).toBe(2);
    });

    it('should handle empty readings', async () => {
      mockPrisma.meterReading.findMany.mockResolvedValue([]);

      const result = await service.getAggregation(
        'user-1',
        'MONTHLY',
        '2024-01-01',
        '2024-01-31',
      );

      expect(result.totalProduction).toBe(0);
      expect(result.totalConsumption).toBe(0);
      expect(result.netEnergy).toBe(0);
      expect(result.readingCount).toBe(0);
    });
  });
});
