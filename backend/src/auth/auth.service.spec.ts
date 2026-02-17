import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { DIDBlockchainService } from '../blockchain/did-blockchain.service';
import { DIDSignatureService } from './services/did-signature.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    dIDCredential: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
  };

  const mockDidService = {
    createDID: jest.fn().mockResolvedValue({
      did: 'did:etp:user-1',
      publicKey: 'mock-public-key',
    }),
    revokeDID: jest.fn().mockResolvedValue(undefined),
  };

  const mockSignatureService = {
    generateChallenge: jest.fn().mockReturnValue({
      challenge: 'mock-challenge-hex',
      expiresAt: new Date(Date.now() + 300000),
    }),
    verifyChallengeResponse: jest.fn().mockResolvedValue({
      valid: true,
      did: 'did:etp:user-1',
      userId: 'user-1',
      message: '서명 검증 성공',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: DIDBlockchainService, useValue: mockDidService },
        { provide: DIDSignatureService, useValue: mockSignatureService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'password123',
      name: '테스트',
      role: 'SUPPLIER' as const,
      organization: '테스트기업',
    };

    it('should register a new user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      const createdUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: '테스트',
        role: 'SUPPLIER',
        organization: '테스트기업',
        password: 'hashed-password',
      };
      mockPrisma.user.create.mockResolvedValue(createdUser);
      mockPrisma.dIDCredential.create.mockResolvedValue({});

      const result = await service.register(registerDto);

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.name).toBe('테스트');
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'test@example.com',
          password: 'hashed-password',
          name: '테스트',
          role: 'SUPPLIER',
        }),
      });
    });

    it('should throw ConflictException for duplicate email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create DID on registration', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: '테스트',
        role: 'SUPPLIER',
        organization: '테스트기업',
      });
      mockPrisma.dIDCredential.create.mockResolvedValue({});

      await service.register(registerDto);

      expect(mockDidService.createDID).toHaveBeenCalledWith(
        'user-1',
        'SUPPLIER',
        '테스트기업',
      );
    });

    it('should not fail registration if DID creation fails', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: '테스트',
        role: 'SUPPLIER',
        organization: '테스트기업',
      });
      mockDidService.createDID.mockRejectedValue(new Error('DID 발급 오류'));

      const result = await service.register(registerDto);
      expect(result.accessToken).toBe('mock-jwt-token');
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      const user = {
        id: 'user-1',
        email: 'test@example.com',
        name: '테스트',
        role: 'SUPPLIER',
        organization: '테스트기업',
        password: 'hashed-password',
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'wrong@example.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        password: 'hashed-password',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    it('should return user profile without password', async () => {
      const user = {
        id: 'user-1',
        email: 'test@example.com',
        name: '테스트',
        role: 'SUPPLIER',
        organization: '테스트기업',
        password: 'hashed-password',
        didCredential: { did: 'did:etp:user-1' },
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getProfile('user-1');
      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe('test@example.com');
      expect(result.didCredential).toBeDefined();
    });

    it('should throw UnauthorizedException for invalid user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('invalid')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('verifyDID', () => {
    it('should verify an active DID', async () => {
      mockPrisma.dIDCredential.findUnique.mockResolvedValue({
        did: 'did:etp:user-1',
        userId: 'user-1',
        status: 'ACTIVE',
        user: { id: 'user-1', name: '테스트', role: 'SUPPLIER', organization: '테스트기업' },
      });

      const result = await service.verifyDID('did:etp:user-1');
      expect(result.valid).toBe(true);
    });

    it('should return invalid for unknown DID', async () => {
      mockPrisma.dIDCredential.findUnique.mockResolvedValue(null);

      const result = await service.verifyDID('did:etp:unknown');
      expect(result.valid).toBe(false);
    });

    it('should return invalid for inactive DID', async () => {
      mockPrisma.dIDCredential.findUnique.mockResolvedValue({
        did: 'did:etp:user-1',
        status: 'REVOKED',
      });

      const result = await service.verifyDID('did:etp:user-1');
      expect(result.valid).toBe(false);
    });
  });

  describe('createDIDChallenge', () => {
    it('should create challenge for valid DID', async () => {
      mockPrisma.dIDCredential.findUnique.mockResolvedValue({
        did: 'did:etp:user-1',
        status: 'ACTIVE',
        user: { id: 'user-1', name: '테스트' },
      });

      const result = await service.createDIDChallenge('did:etp:user-1');
      expect(result.challenge).toBe('mock-challenge-hex');
      expect(result.did).toBe('did:etp:user-1');
    });

    it('should reject invalid DID', async () => {
      mockPrisma.dIDCredential.findUnique.mockResolvedValue(null);

      await expect(
        service.createDIDChallenge('did:etp:invalid'),
      ).rejects.toThrow();
    });
  });

  describe('loginWithDID', () => {
    it('should login with valid DID challenge-response', async () => {
      // 먼저 챌린지 생성
      mockPrisma.dIDCredential.findUnique.mockResolvedValue({
        did: 'did:etp:user-1',
        status: 'ACTIVE',
        user: { id: 'user-1', name: '테스트' },
      });
      await service.createDIDChallenge('did:etp:user-1');

      // DID 로그인
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: '테스트',
        role: 'SUPPLIER',
        organization: '테스트기업',
      });

      const result = await service.loginWithDID('did:etp:user-1', 'valid-sig');
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.authMethod).toBe('DID');
    });

    it('should reject without challenge', async () => {
      await expect(
        service.loginWithDID('did:etp:unknown', 'sig'),
      ).rejects.toThrow();
    });
  });

  describe('revokeDID', () => {
    it('should revoke an active DID', async () => {
      mockPrisma.dIDCredential.findUnique.mockResolvedValue({
        did: 'did:etp:user-1',
        userId: 'user-1',
        status: 'ACTIVE',
      });
      mockPrisma.dIDCredential.update.mockResolvedValue({
        did: 'did:etp:user-1',
        status: 'REVOKED',
      });

      const result = await service.revokeDID('user-1');
      expect(result.status).toBe('REVOKED');
    });

    it('should reject if no DID exists', async () => {
      mockPrisma.dIDCredential.findUnique.mockResolvedValue(null);

      await expect(service.revokeDID('user-1')).rejects.toThrow();
    });
  });
});
