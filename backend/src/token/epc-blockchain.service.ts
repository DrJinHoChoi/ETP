import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class EPCBlockchainService {
  private readonly epcChaincode: string;
  private readonly recTokenChaincode: string;

  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly configService: ConfigService,
  ) {
    this.epcChaincode = this.configService.get(
      'FABRIC_CHAINCODE_EPC',
      'epc-cc',
    );
    this.recTokenChaincode = this.configService.get(
      'FABRIC_CHAINCODE_REC_TOKEN',
      'rec-token-cc',
    );
  }

  // ========== EPC 토큰 ==========

  async mint(
    userId: string,
    amount: number,
    reason: string,
    refId: string,
  ): Promise<string> {
    return this.blockchainService.submitTransaction(
      this.epcChaincode,
      'Mint',
      userId,
      amount.toString(),
      reason,
      refId,
    );
  }

  async burn(
    userId: string,
    amount: number,
    reason: string,
    refId: string,
  ): Promise<string> {
    return this.blockchainService.submitTransaction(
      this.epcChaincode,
      'Burn',
      userId,
      amount.toString(),
      reason,
      refId,
    );
  }

  async transfer(
    from: string,
    to: string,
    amount: number,
    reason: string,
    refId: string,
  ): Promise<string> {
    return this.blockchainService.submitTransaction(
      this.epcChaincode,
      'Transfer',
      from,
      to,
      amount.toString(),
      reason,
      refId,
    );
  }

  async lock(userId: string, amount: number, refId: string): Promise<string> {
    return this.blockchainService.submitTransaction(
      this.epcChaincode,
      'Lock',
      userId,
      amount.toString(),
      refId,
    );
  }

  async unlock(
    userId: string,
    amount: number,
    refId: string,
  ): Promise<string> {
    return this.blockchainService.submitTransaction(
      this.epcChaincode,
      'Unlock',
      userId,
      amount.toString(),
      refId,
    );
  }

  async getBalance(userId: string): Promise<string> {
    return this.blockchainService.evaluateTransaction(
      this.epcChaincode,
      'BalanceOf',
      userId,
    );
  }

  async setPrice(
    priceId: string,
    source: string,
    price: number,
    currency: string,
    basketPrice: number,
    timestamp: string,
  ): Promise<string> {
    return this.blockchainService.submitTransaction(
      this.epcChaincode,
      'SetPrice',
      priceId,
      source,
      price.toString(),
      currency,
      basketPrice.toString(),
      timestamp,
    );
  }

  // ========== REC 토큰 ==========

  async issueRECToken(
    tokenId: string,
    certId: string,
    tradeId: string,
    issuerId: string,
    ownerId: string,
    energySource: string,
    quantity: number,
    vintage: string,
    location: string,
    validUntil: string,
    metadataHash: string,
  ): Promise<string> {
    return this.blockchainService.submitTransaction(
      this.recTokenChaincode,
      'IssueREC',
      tokenId,
      certId,
      tradeId,
      issuerId,
      ownerId,
      energySource,
      quantity.toString(),
      vintage,
      location,
      validUntil,
      metadataHash,
    );
  }

  async transferRECToken(
    tokenId: string,
    fromId: string,
    toId: string,
  ): Promise<string> {
    return this.blockchainService.submitTransaction(
      this.recTokenChaincode,
      'TransferREC',
      tokenId,
      fromId,
      toId,
    );
  }

  async retireRECToken(
    tokenId: string,
    retiredBy: string,
  ): Promise<string> {
    return this.blockchainService.submitTransaction(
      this.recTokenChaincode,
      'RetireREC',
      tokenId,
      retiredBy,
    );
  }
}
