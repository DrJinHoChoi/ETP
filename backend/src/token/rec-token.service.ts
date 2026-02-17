import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Optional,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EPCBlockchainService } from './epc-blockchain.service';
import { TokenService } from './token.service';
import { EventsGateway } from '../common/gateways/events.gateway';
import { RECTokenStatus, EnergySource } from '@prisma/client';
import { createHash } from 'crypto';

@Injectable()
export class RECTokenService {
  private readonly logger = new Logger(RECTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly epcBlockchain: EPCBlockchainService,
    private readonly eventsGateway: EventsGateway,
    @Optional() @Inject(TokenService) private readonly tokenService?: TokenService,
  ) {}

  /** 기존 RECCertificate에서 NFT 토큰 발행 */
  async issueFromCertificate(certId: string) {
    const cert = await this.prisma.rECCertificate.findUnique({
      where: { id: certId },
      include: { trade: true },
    });
    if (!cert) {
      throw new NotFoundException('REC 인증서를 찾을 수 없습니다');
    }

    // 이미 토큰화 확인
    const existing = await this.prisma.rECToken.findUnique({
      where: { certId },
    });
    if (existing) {
      throw new BadRequestException('이미 토큰화된 REC 인증서입니다');
    }

    const now = new Date();
    const vintage = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 메타데이터 해시 생성
    const metadataHash = createHash('sha256')
      .update(
        JSON.stringify({
          certId,
          tradeId: cert.tradeId,
          energySource: cert.energySource,
          quantity: cert.quantity,
          issuedAt: cert.issuedAt,
        }),
      )
      .digest('hex');

    // DB에 REC 토큰 생성
    const recToken = await this.prisma.rECToken.create({
      data: {
        certId,
        tradeId: cert.tradeId,
        issuerId: cert.supplierId,
        ownerId: cert.consumerId,
        energySource: cert.energySource,
        quantity: cert.quantity,
        vintage,
        validUntil: cert.validUntil,
        metadataHash,
      },
    });

    // 블록체인에 기록
    try {
      const txHash = await this.epcBlockchain.issueRECToken(
        recToken.id,
        certId,
        cert.tradeId,
        cert.supplierId,
        cert.consumerId,
        cert.energySource,
        cert.quantity,
        vintage,
        '',
        cert.validUntil.toISOString(),
        metadataHash,
      );

      await this.prisma.rECToken.update({
        where: { id: recToken.id },
        data: { txHash },
      });
    } catch (error) {
      this.logger.error(`블록체인 REC 발행 실패: ${error.message}`);
    }

    this.eventsGateway.emitRECTokenUpdate({
      action: 'issued',
      token: recToken,
    });

    return recToken;
  }

  /** REC 토큰 양도 */
  async transfer(tokenId: string, fromUserId: string, toUserId: string) {
    const token = await this.prisma.rECToken.findUnique({
      where: { id: tokenId },
    });
    if (!token) {
      throw new NotFoundException('REC 토큰을 찾을 수 없습니다');
    }
    if (token.ownerId !== fromUserId) {
      throw new BadRequestException('소유자만 양도할 수 있습니다');
    }
    if (token.status !== RECTokenStatus.ACTIVE) {
      throw new BadRequestException('양도 가능한 상태가 아닙니다');
    }

    try {
      await this.epcBlockchain.transferRECToken(tokenId, fromUserId, toUserId);
    } catch (error) {
      this.logger.error(`블록체인 REC 양도 실패: ${error.message}`);
    }

    const updated = await this.prisma.rECToken.update({
      where: { id: tokenId },
      data: { ownerId: toUserId },
    });

    this.eventsGateway.emitRECTokenUpdate({
      action: 'transferred',
      token: updated,
    });

    return updated;
  }

  /** REC 토큰 소멸 (RE100 달성 처리) */
  async retire(tokenId: string, userId: string) {
    const token = await this.prisma.rECToken.findUnique({
      where: { id: tokenId },
    });
    if (!token) {
      throw new NotFoundException('REC 토큰을 찾을 수 없습니다');
    }
    if (token.ownerId !== userId) {
      throw new BadRequestException('소유자만 소멸할 수 있습니다');
    }
    if (token.status === RECTokenStatus.RETIRED) {
      throw new BadRequestException('이미 소멸된 토큰입니다');
    }

    try {
      await this.epcBlockchain.retireRECToken(tokenId, userId);
    } catch (error) {
      this.logger.error(`블록체인 REC 소멸 실패: ${error.message}`);
    }

    const updated = await this.prisma.rECToken.update({
      where: { id: tokenId },
      data: {
        status: RECTokenStatus.RETIRED,
        retiredAt: new Date(),
        retiredBy: userId,
      },
    });

    this.eventsGateway.emitRECTokenUpdate({
      action: 'retired',
      token: updated,
    });

    return updated;
  }

  /** 소유자별 토큰 조회 */
  async getTokensByOwner(userId: string, status?: RECTokenStatus) {
    return this.prisma.rECToken.findMany({
      where: {
        ownerId: userId,
        ...(status && { status }),
      },
      include: {
        issuer: { select: { id: true, name: true, organization: true } },
        certificate: true,
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  /** 단일 토큰 조회 */
  async getToken(tokenId: string) {
    const token = await this.prisma.rECToken.findUnique({
      where: { id: tokenId },
      include: {
        issuer: { select: { id: true, name: true, organization: true } },
        owner: { select: { id: true, name: true, organization: true } },
        certificate: true,
      },
    });
    if (!token) {
      throw new NotFoundException('REC 토큰을 찾을 수 없습니다');
    }
    return token;
  }

  /** 마켓플레이스 (ACTIVE 토큰 목록) */
  async getMarketplace(filters?: {
    energySource?: EnergySource;
    minQty?: number;
  }) {
    return this.prisma.rECToken.findMany({
      where: {
        status: RECTokenStatus.ACTIVE,
        ...(filters?.energySource && { energySource: filters.energySource }),
        ...(filters?.minQty && { quantity: { gte: filters.minQty } }),
      },
      include: {
        issuer: { select: { id: true, name: true, organization: true } },
        owner: { select: { id: true, name: true, organization: true } },
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  /** REC 토큰 구매 (EPC 결제) */
  async purchaseToken(tokenId: string, buyerUserId: string, epcAmount: number) {
    const token = await this.prisma.rECToken.findUnique({
      where: { id: tokenId },
      include: { owner: { select: { id: true, name: true } } },
    });
    if (!token) {
      throw new NotFoundException('REC 토큰을 찾을 수 없습니다');
    }
    if (token.status !== RECTokenStatus.ACTIVE) {
      throw new BadRequestException('구매 가능한 상태가 아닙니다');
    }
    if (token.ownerId === buyerUserId) {
      throw new BadRequestException('자신의 토큰은 구매할 수 없습니다');
    }
    if (epcAmount <= 0) {
      throw new BadRequestException('EPC 금액은 0보다 커야 합니다');
    }

    // EPC 이체: buyer → owner
    if (this.tokenService) {
      await this.tokenService.transfer(
        buyerUserId,
        token.ownerId,
        epcAmount,
        'rec-purchase',
        tokenId,
      );
    }

    // 소유권 이전
    const previousOwner = token.ownerId;
    const updated = await this.prisma.rECToken.update({
      where: { id: tokenId },
      data: { ownerId: buyerUserId },
    });

    // 블록체인 기록
    try {
      await this.epcBlockchain.transferRECToken(tokenId, previousOwner, buyerUserId);
    } catch (error) {
      this.logger.error(`블록체인 REC 구매 기록 실패: ${error.message}`);
    }

    this.logger.log(`REC 토큰 구매: ${tokenId}, 구매자: ${buyerUserId}, 판매자: ${previousOwner}, EPC: ${epcAmount}`);

    this.eventsGateway.emitRECTokenUpdate({
      action: 'purchased',
      token: updated,
      buyerId: buyerUserId,
      previousOwnerId: previousOwner,
      epcAmount,
    });

    return {
      ...updated,
      epcPaid: epcAmount,
      previousOwnerId: previousOwner,
    };
  }
}
