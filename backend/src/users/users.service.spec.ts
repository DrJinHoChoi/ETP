import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;

  const mockPrisma = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    order: {
      count: jest.fn(),
    },
    trade: {
      count: jest.fn(),
    },
    dIDCredential: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      const users = [
        { id: '1', email: 'a@test.com', name: 'User A', role: 'SUPPLIER' },
      ];
      mockPrisma.user.findMany.mockResolvedValue(users);

      const result = await service.findAll();
      expect(result).toEqual(users);
    });

    it('should filter by role', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await service.findAll('ADMIN' as any);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: 'ADMIN' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return user by id', async () => {
      const user = { id: '1', email: 'a@test.com', name: 'User A' };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.findOne('1');
      expect(result).toEqual(user);
    });

    it('should throw NotFoundException for invalid id', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDashboardStats', () => {
    it('should return order and trade counts', async () => {
      mockPrisma.order.count.mockResolvedValue(5);
      mockPrisma.trade.count.mockResolvedValue(3);

      const result = await service.getDashboardStats('user-1');
      expect(result.orderCount).toBe(5);
      expect(result.tradeCount).toBe(3);
    });
  });

  // ─── Phase 4 신규 테스트 ───

  describe('updateUser', () => {
    it('should update user name', async () => {
      const user = { id: 'user-1', name: 'Old Name', organization: 'Org' };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      const updated = { ...user, name: 'New Name' };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateUser('user-1', { name: 'New Name' });
      expect(result.name).toBe('New Name');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ name: 'New Name' }),
        }),
      );
    });

    it('should update user organization', async () => {
      const user = { id: 'user-1', name: 'User', organization: 'Old Org' };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      const updated = { ...user, organization: 'New Org' };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateUser('user-1', { organization: 'New Org' });
      expect(result.organization).toBe('New Org');
    });

    it('should update user status', async () => {
      const user = { id: 'user-1', name: 'User', status: 'ACTIVE' };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      const updated = { ...user, status: 'SUSPENDED' };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateUser('user-1', { status: 'SUSPENDED' as any });
      expect(result.status).toBe('SUSPENDED');
    });

    it('should throw NotFoundException for invalid user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateUser('invalid', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate user and revoke DID', async () => {
      const user = {
        id: 'user-1',
        email: 'user@test.com',
        status: 'ACTIVE',
        didCredential: { id: 'did-1', did: 'did:etp:user-1', status: 'ACTIVE' },
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await service.deactivateUser('user-1');
      expect(result.id).toBe('user-1');
      expect(result.status).toBe('SUSPENDED');
      expect(result.didRevoked).toBe(true);
    });

    it('should deactivate user without DID', async () => {
      const user = {
        id: 'user-2',
        email: 'user2@test.com',
        status: 'ACTIVE',
        didCredential: null,
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.$transaction.mockResolvedValue([{}]);

      const result = await service.deactivateUser('user-2');
      expect(result.id).toBe('user-2');
      expect(result.status).toBe('SUSPENDED');
      expect(result.didRevoked).toBe(false);
    });

    it('should not revoke already revoked DID', async () => {
      const user = {
        id: 'user-3',
        email: 'user3@test.com',
        status: 'ACTIVE',
        didCredential: { id: 'did-3', did: 'did:etp:user-3', status: 'REVOKED' },
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.$transaction.mockResolvedValue([{}]);

      const result = await service.deactivateUser('user-3');
      expect(result.didRevoked).toBe(true);
      // $transaction should only have 1 operation (user update only, no DID update)
      const transactionCall = mockPrisma.$transaction.mock.calls[0][0];
      expect(transactionCall).toHaveLength(1);
    });

    it('should throw NotFoundException for invalid user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.deactivateUser('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAllUsersWithStats', () => {
    it('should return users with stats', async () => {
      const users = [
        {
          id: 'u1',
          email: 'a@test.com',
          name: 'User A',
          role: 'SUPPLIER',
          organization: 'Org A',
          status: 'ACTIVE',
          createdAt: new Date(),
          didCredential: { did: 'did:etp:u1', status: 'ACTIVE' },
          _count: { orders: 5, buyTrades: 2, sellTrades: 3 },
        },
        {
          id: 'u2',
          email: 'b@test.com',
          name: 'User B',
          role: 'CONSUMER',
          organization: 'Org B',
          status: 'ACTIVE',
          createdAt: new Date(),
          didCredential: null,
          _count: { orders: 0, buyTrades: 0, sellTrades: 0 },
        },
      ];
      mockPrisma.user.findMany.mockResolvedValue(users);

      const result = await service.getAllUsersWithStats();
      expect(result).toHaveLength(2);
      expect(result[0].did).toBe('did:etp:u1');
      expect(result[0].didStatus).toBe('ACTIVE');
      expect(result[0].orderCount).toBe(5);
      expect(result[0].tradeCount).toBe(5); // buyTrades + sellTrades
      expect(result[1].did).toBeNull();
      expect(result[1].didStatus).toBeNull();
      expect(result[1].tradeCount).toBe(0);
    });
  });
});
