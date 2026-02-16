import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EPCBlockchainService } from './epc-blockchain.service';
import { OracleService } from '../oracle/oracle.service';
import { EventsGateway } from '../common/gateways/events.gateway';
import { TokenTxType } from '@prisma/client';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly epcBlockchain: EPCBlockchainService,
    private readonly oracleService: OracleService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async getOrCreateWallet(userId: string) {
    let wallet = await this.prisma.tokenBalance.findUnique({
      where: { userId },
    });

    if (!wallet) {
      wallet = await this.prisma.tokenBalance.create({
        data: { userId, balance: 0, lockedBalance: 0 },
      });
    }

    return wallet;
  }

  async getBalance(userId: string) {
    const wallet = await this.getOrCreateWallet(userId);
    return {
      balance: wallet.balance,
      lockedBalance: wallet.lockedBalance,
      availableBalance: wallet.balance - wallet.lockedBalance,
    };
  }

  /** 검증된 발전량으로부터 EPC 발행 (1 EPC = 1 kWh) */
  async mintFromMeterReading(
    userId: string,
    kWh: number,
    meterReadingId: string,
  ) {
    if (kWh <= 0) return null;

    // EPC 수량 = kWh (수량 기반 페깅)
    const amount = kWh;

    // 블록체인 기록
    let txHash: string | null = null;
    try {
      txHash = await this.epcBlockchain.mint(
        userId,
        amount,
        'meter_verified',
        meterReadingId,
      );
    } catch (error) {
      this.logger.error(`블록체인 mint 실패: ${error.message}`);
    }

    // DB 업데이트
    const [wallet, tx] = await this.prisma.$transaction([
      this.prisma.tokenBalance.upsert({
        where: { userId },
        update: { balance: { increment: amount } },
        create: { userId, balance: amount, lockedBalance: 0 },
      }),
      this.prisma.tokenTransaction.create({
        data: {
          type: TokenTxType.MINT,
          toId: userId,
          amount,
          reason: 'meter_verified',
          refId: meterReadingId,
          txHash,
        },
      }),
    ]);

    this.eventsGateway.emitTokenBalanceUpdate({
      userId,
      balance: wallet.balance,
      lockedBalance: wallet.lockedBalance,
    });

    return tx;
  }

  /** 정산 수수료 소각 */
  async burnForSettlement(
    userId: string,
    amount: number,
    settlementId: string,
  ) {
    const wallet = await this.getOrCreateWallet(userId);
    if (wallet.balance < amount) {
      throw new BadRequestException('EPC 잔액이 부족합니다');
    }

    let txHash: string | null = null;
    try {
      txHash = await this.epcBlockchain.burn(
        userId,
        amount,
        'settlement_fee',
        settlementId,
      );
    } catch (error) {
      this.logger.error(`블록체인 burn 실패: ${error.message}`);
    }

    const [updated, tx] = await this.prisma.$transaction([
      this.prisma.tokenBalance.update({
        where: { userId },
        data: { balance: { decrement: amount } },
      }),
      this.prisma.tokenTransaction.create({
        data: {
          type: TokenTxType.BURN,
          fromId: userId,
          amount,
          reason: 'settlement_fee',
          refId: settlementId,
          txHash,
        },
      }),
    ]);

    this.eventsGateway.emitTokenBalanceUpdate({
      userId,
      balance: updated.balance,
      lockedBalance: updated.lockedBalance,
    });

    return tx;
  }

  /** EPC 이체 */
  async transfer(
    fromUserId: string,
    toUserId: string,
    amount: number,
    reason: string,
    refId?: string,
  ) {
    if (fromUserId === toUserId) {
      throw new BadRequestException('자기 자신에게 이체할 수 없습니다');
    }

    const fromWallet = await this.getOrCreateWallet(fromUserId);
    const available = fromWallet.balance - fromWallet.lockedBalance;
    if (available < amount) {
      throw new BadRequestException(
        `가용 EPC 잔액 부족: ${available.toFixed(2)} / ${amount.toFixed(2)}`,
      );
    }

    let txHash: string | null = null;
    try {
      txHash = await this.epcBlockchain.transfer(
        fromUserId,
        toUserId,
        amount,
        reason,
        refId || '',
      );
    } catch (error) {
      this.logger.error(`블록체인 transfer 실패: ${error.message}`);
    }

    const [fromUpdated, toUpdated, tx] = await this.prisma.$transaction([
      this.prisma.tokenBalance.update({
        where: { userId: fromUserId },
        data: { balance: { decrement: amount } },
      }),
      this.prisma.tokenBalance.upsert({
        where: { userId: toUserId },
        update: { balance: { increment: amount } },
        create: { userId: toUserId, balance: amount, lockedBalance: 0 },
      }),
      this.prisma.tokenTransaction.create({
        data: {
          type: TokenTxType.TRANSFER,
          fromId: fromUserId,
          toId: toUserId,
          amount,
          reason,
          refId,
          txHash,
        },
      }),
    ]);

    this.eventsGateway.emitTokenBalanceUpdate({
      userId: fromUserId,
      balance: fromUpdated.balance,
      lockedBalance: fromUpdated.lockedBalance,
    });
    this.eventsGateway.emitTokenBalanceUpdate({
      userId: toUserId,
      balance: toUpdated.balance,
      lockedBalance: toUpdated.lockedBalance,
    });

    return tx;
  }

  /** 거래 대기 잠금 */
  async lockForTrade(userId: string, amount: number, orderId: string) {
    const wallet = await this.getOrCreateWallet(userId);
    const available = wallet.balance - wallet.lockedBalance;
    if (available < amount) {
      throw new BadRequestException(
        `가용 EPC 잔액 부족 (잠금 불가): ${available.toFixed(2)} / ${amount.toFixed(2)}`,
      );
    }

    try {
      await this.epcBlockchain.lock(userId, amount, orderId);
    } catch (error) {
      this.logger.error(`블록체인 lock 실패: ${error.message}`);
    }

    const updated = await this.prisma.tokenBalance.update({
      where: { userId },
      data: { lockedBalance: { increment: amount } },
    });

    await this.prisma.tokenTransaction.create({
      data: {
        type: TokenTxType.LOCK,
        fromId: userId,
        amount,
        reason: 'trade_lock',
        refId: orderId,
      },
    });

    this.eventsGateway.emitTokenBalanceUpdate({
      userId,
      balance: updated.balance,
      lockedBalance: updated.lockedBalance,
    });
  }

  /** 거래 취소 시 잠금 해제 */
  async unlockFromCancelledTrade(
    userId: string,
    amount: number,
    orderId: string,
  ) {
    try {
      await this.epcBlockchain.unlock(userId, amount, orderId);
    } catch (error) {
      this.logger.error(`블록체인 unlock 실패: ${error.message}`);
    }

    const updated = await this.prisma.tokenBalance.update({
      where: { userId },
      data: { lockedBalance: { decrement: amount } },
    });

    await this.prisma.tokenTransaction.create({
      data: {
        type: TokenTxType.UNLOCK,
        toId: userId,
        amount,
        reason: 'trade_cancelled',
        refId: orderId,
      },
    });

    this.eventsGateway.emitTokenBalanceUpdate({
      userId,
      balance: updated.balance,
      lockedBalance: updated.lockedBalance,
    });
  }

  /** 거래 이력 조회 */
  async getTransactions(
    userId: string,
    filters?: { type?: TokenTxType; from?: Date; to?: Date },
  ) {
    return this.prisma.tokenTransaction.findMany({
      where: {
        OR: [{ fromId: userId }, { toId: userId }],
        ...(filters?.type && { type: filters.type }),
        ...(filters?.from || filters?.to
          ? {
              createdAt: {
                ...(filters?.from && { gte: filters.from }),
                ...(filters?.to && { lte: filters.to }),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /** 관리자 EPC 발행 */
  async adminMint(userId: string, amount: number, reason: string) {
    let txHash: string | null = null;
    try {
      txHash = await this.epcBlockchain.mint(
        userId,
        amount,
        'admin_mint',
        reason,
      );
    } catch (error) {
      this.logger.error(`블록체인 admin mint 실패: ${error.message}`);
    }

    const [wallet, tx] = await this.prisma.$transaction([
      this.prisma.tokenBalance.upsert({
        where: { userId },
        update: { balance: { increment: amount } },
        create: { userId, balance: amount, lockedBalance: 0 },
      }),
      this.prisma.tokenTransaction.create({
        data: {
          type: TokenTxType.MINT,
          toId: userId,
          amount,
          reason: `admin: ${reason}`,
          txHash,
        },
      }),
    ]);

    return tx;
  }
}
