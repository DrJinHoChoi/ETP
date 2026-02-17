import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface SignedPayload {
  payload: string;       // JSON 문자열 (서명 대상)
  signature: string;     // hex-encoded Ed25519 서명
  did: string;           // 서명자의 DID
}

export interface VerificationResult {
  valid: boolean;
  did: string;
  userId: string;
  message: string;
}

/**
 * DID 기반 트랜잭션 서명/검증 서비스
 *
 * Ed25519 키 쌍을 사용하여 거래 데이터의 무결성과 부인 방지를 보장한다.
 * - 클라이언트: privateKey로 payload 서명 → { payload, signature, did }
 * - 서버: DB에 저장된 publicKey로 서명 검증
 */
@Injectable()
export class DIDSignatureService {
  private readonly logger = new Logger(DIDSignatureService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 서명 검증
   * 클라이언트가 보낸 { payload, signature, did }를 검증한다.
   */
  async verifySignature(signed: SignedPayload): Promise<VerificationResult> {
    // 1. DID 조회
    const credential = await this.prisma.dIDCredential.findUnique({
      where: { did: signed.did },
    });

    if (!credential) {
      return {
        valid: false,
        did: signed.did,
        userId: '',
        message: 'DID가 존재하지 않습니다',
      };
    }

    if (credential.status !== 'ACTIVE') {
      return {
        valid: false,
        did: signed.did,
        userId: credential.userId,
        message: 'DID가 비활성 상태입니다',
      };
    }

    // 2. 공개키로 서명 검증
    try {
      const publicKeyDER = Buffer.from(credential.publicKey, 'hex');
      const publicKey = crypto.createPublicKey({
        key: publicKeyDER,
        format: 'der',
        type: 'spki',
      });

      const isValid = crypto.verify(
        null,
        Buffer.from(signed.payload),
        publicKey,
        Buffer.from(signed.signature, 'hex'),
      );

      if (!isValid) {
        return {
          valid: false,
          did: signed.did,
          userId: credential.userId,
          message: '서명 검증 실패: 유효하지 않은 서명',
        };
      }

      return {
        valid: true,
        did: signed.did,
        userId: credential.userId,
        message: '서명 검증 성공',
      };
    } catch (error) {
      this.logger.error(`서명 검증 오류: ${error.message}`);
      return {
        valid: false,
        did: signed.did,
        userId: credential.userId,
        message: `서명 검증 오류: ${error.message}`,
      };
    }
  }

  /**
   * 서명된 주문 검증 (거래 생성 시)
   * payload의 userId와 DID 소유자가 일치하는지도 확인
   */
  async verifySignedOrder(
    signed: SignedPayload,
    expectedUserId: string,
  ): Promise<void> {
    const result = await this.verifySignature(signed);

    if (!result.valid) {
      throw new BadRequestException(result.message);
    }

    if (result.userId !== expectedUserId) {
      throw new BadRequestException(
        'DID 소유자와 요청 사용자가 일치하지 않습니다',
      );
    }
  }

  /**
   * 챌린지 생성 (DID 인증 용)
   */
  generateChallenge(): { challenge: string; expiresAt: Date } {
    const challenge = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5분 유효
    return { challenge, expiresAt };
  }

  /**
   * 챌린지-응답 검증 (DID 기반 로그인)
   */
  async verifyChallengeResponse(
    did: string,
    challenge: string,
    signature: string,
  ): Promise<VerificationResult> {
    return this.verifySignature({
      payload: challenge,
      signature,
      did,
    });
  }
}
