import {
  Injectable,
  Inject,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { DIDBlockchainService } from '../blockchain/did-blockchain.service';
import { DIDSignatureService } from './services/did-signature.service';
import { REDIS_CLIENT } from '../common/redis/redis.module';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly didService: DIDBlockchainService,
    private readonly didSignatureService: DIDSignatureService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('이미 등록된 이메일입니다');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        role: dto.role,
        organization: dto.organization,
      },
    });

    // DID 발급
    try {
      const { did, publicKey } = await this.didService.createDID(
        user.id,
        user.role,
        user.organization,
      );

      await this.prisma.dIDCredential.create({
        data: {
          userId: user.id,
          did,
          publicKey,
        },
      });

      this.logger.log(`DID 발급 완료: ${did} (user: ${user.id})`);
    } catch (error) {
      this.logger.warn(`DID 발급 실패 (user: ${user.id}): ${error}`);
    }

    const token = this.generateToken(user.id, user.role);

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organization: user.organization,
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
    }

    const token = this.generateToken(user.id, user.role);

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organization: user.organization,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { didCredential: true },
    });
    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다');
    }
    const { password: _, ...result } = user;
    return result;
  }

  async issueDID(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { didCredential: true },
    });
    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다');
    }
    if (user.didCredential) {
      return user.didCredential;
    }

    const { did, publicKey } = await this.didService.createDID(
      user.id,
      user.role,
      user.organization,
    );

    return this.prisma.dIDCredential.create({
      data: {
        userId: user.id,
        did,
        publicKey,
      },
    });
  }

  async verifyDID(did: string) {
    const credential = await this.prisma.dIDCredential.findUnique({
      where: { did },
      include: { user: { select: { id: true, name: true, role: true, organization: true } } },
    });

    if (!credential) {
      return { valid: false, message: 'DID가 존재하지 않습니다' };
    }

    if (credential.status !== 'ACTIVE') {
      return { valid: false, message: 'DID가 비활성 상태입니다' };
    }

    return {
      valid: true,
      message: 'DID 검증 성공',
      credential: {
        did: credential.did,
        userId: credential.userId,
        status: credential.status,
        user: credential.user,
      },
    };
  }

  /**
   * DID 챌린지 생성 (DID 기반 로그인 1단계)
   * Redis에 5분 TTL로 저장하여 서버 재시작/스케일아웃에도 안전
   */
  async createDIDChallenge(did: string) {
    const credential = await this.prisma.dIDCredential.findUnique({
      where: { did },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!credential || credential.status !== 'ACTIVE') {
      throw new BadRequestException('유효하지 않은 DID입니다');
    }

    const { challenge, expiresAt } = this.didSignatureService.generateChallenge();

    // Redis에 저장 (5분 TTL)
    await this.redis.set(
      `did:challenge:${did}`,
      JSON.stringify({ challenge, expiresAt: expiresAt.toISOString() }),
      'EX',
      300,
    );

    return { challenge, expiresAt, did };
  }

  /**
   * DID 챌린지-응답 검증 (DID 기반 로그인 2단계)
   */
  async loginWithDID(did: string, signature: string) {
    const raw = await this.redis.get(`did:challenge:${did}`);
    if (!raw) {
      throw new BadRequestException('챌린지가 존재하지 않습니다. 먼저 챌린지를 요청하세요.');
    }

    const stored = JSON.parse(raw) as { challenge: string; expiresAt: string };

    if (new Date() > new Date(stored.expiresAt)) {
      await this.redis.del(`did:challenge:${did}`);
      throw new BadRequestException('챌린지가 만료되었습니다');
    }

    const result = await this.didSignatureService.verifyChallengeResponse(
      did,
      stored.challenge,
      signature,
    );

    if (!result.valid) {
      throw new UnauthorizedException(`DID 인증 실패: ${result.message}`);
    }

    await this.redis.del(`did:challenge:${did}`);

    const user = await this.prisma.user.findUnique({
      where: { id: result.userId },
    });

    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다');
    }

    const token = this.generateToken(user.id, user.role);

    this.logger.log(`DID 인증 로그인: ${did} (user: ${user.id})`);

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organization: user.organization,
      },
      authMethod: 'DID',
    };
  }

  /**
   * DID 폐기
   */
  async revokeDID(userId: string) {
    const credential = await this.prisma.dIDCredential.findUnique({
      where: { userId },
    });

    if (!credential) {
      throw new BadRequestException('DID가 발급되지 않았습니다');
    }

    if (credential.status === 'REVOKED') {
      throw new BadRequestException('이미 폐기된 DID입니다');
    }

    // 블록체인에서 폐기
    try {
      await this.didService.revokeDID(credential.did);
    } catch (error) {
      this.logger.warn(`블록체인 DID 폐기 실패: ${error.message}`);
    }

    // DB에서 상태 변경
    const updated = await this.prisma.dIDCredential.update({
      where: { userId },
      data: { status: 'REVOKED' },
    });

    this.logger.log(`DID 폐기: ${credential.did} (user: ${userId})`);

    return {
      did: updated.did,
      status: updated.status,
      message: 'DID가 성공적으로 폐기되었습니다',
    };
  }

  private generateToken(userId: string, role: string): string {
    return this.jwtService.sign({ sub: userId, role });
  }
}
