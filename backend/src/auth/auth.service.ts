import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { DIDBlockchainService } from '../blockchain/did-blockchain.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly didService: DIDBlockchainService,
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

  private generateToken(userId: string, role: string): string {
    return this.jwtService.sign({ sub: userId, role });
  }
}
