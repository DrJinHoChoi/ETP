import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * DID 인증 가드
 *
 * JwtAuthGuard 이후에 적용하여, 사용자에게 활성 DID가 있는지 확인한다.
 * DID가 없거나 REVOKED 상태이면 거래/정산 등 핵심 기능 접근을 차단한다.
 */
@Injectable()
export class DIDAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      throw new ForbiddenException('인증 정보가 없습니다');
    }

    const credential = await this.prisma.dIDCredential.findUnique({
      where: { userId },
    });

    if (!credential) {
      throw new ForbiddenException(
        'DID가 발급되지 않았습니다. 프로필에서 DID를 발급받으세요.',
      );
    }

    if (credential.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'DID가 비활성 상태입니다. 관리자에게 문의하세요.',
      );
    }

    // DID 정보를 request에 첨부
    request.did = {
      did: credential.did,
      publicKey: credential.publicKey,
      status: credential.status,
    };

    return true;
  }
}
