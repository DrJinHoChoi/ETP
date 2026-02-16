import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from './blockchain.service';

@Injectable()
export class TradingBlockchainService {
  private readonly logger = new Logger(TradingBlockchainService.name);
  private readonly tradingChaincode: string;
  private readonly settlementChaincode: string;
  private readonly meteringChaincode: string;

  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly configService: ConfigService,
  ) {
    this.tradingChaincode = this.configService.get<string>(
      'FABRIC_CHAINCODE_TRADING',
      'trading-cc',
    );
    this.settlementChaincode = this.configService.get<string>(
      'FABRIC_CHAINCODE_SETTLEMENT',
      'settlement-cc',
    );
    this.meteringChaincode = this.configService.get<string>(
      'FABRIC_CHAINCODE_METERING',
      'metering-cc',
    );
  }

  // ========== Trading ==========

  async recordTrade(
    tradeId: string,
    buyOrderId: string,
    sellOrderId: string,
    buyerId: string,
    sellerId: string,
    energySource: string,
    quantity: number,
    price: number,
  ): Promise<string> {
    const result = await this.blockchainService.submitTransaction(
      this.tradingChaincode,
      'CreateTrade',
      tradeId,
      buyOrderId,
      sellOrderId,
      buyerId,
      sellerId,
      energySource,
      quantity.toString(),
      price.toString(),
    );

    this.logger.log(`거래 블록체인 기록: ${tradeId}`);
    return result;
  }

  async getTradeFromChain(tradeId: string) {
    const result = await this.blockchainService.evaluateTransaction(
      this.tradingChaincode,
      'GetTrade',
      tradeId,
    );
    return JSON.parse(result);
  }

  async updateTradeStatus(tradeId: string, status: string): Promise<void> {
    await this.blockchainService.submitTransaction(
      this.tradingChaincode,
      'UpdateTradeStatus',
      tradeId,
      status,
    );
  }

  async issueREC(
    certId: string,
    tradeId: string,
    supplierId: string,
    consumerId: string,
    energySource: string,
    quantity: number,
    validUntil: string,
  ): Promise<string> {
    const result = await this.blockchainService.submitTransaction(
      this.tradingChaincode,
      'IssueREC',
      certId,
      tradeId,
      supplierId,
      consumerId,
      energySource,
      quantity.toString(),
      validUntil,
    );

    this.logger.log(`REC 인증서 발급: ${certId} (trade: ${tradeId})`);
    return result;
  }

  // ========== Settlement ==========

  async recordSettlement(
    settlementId: string,
    tradeId: string,
    buyerId: string,
    sellerId: string,
    amount: number,
    fee: number,
  ): Promise<string> {
    const result = await this.blockchainService.submitTransaction(
      this.settlementChaincode,
      'CreateSettlement',
      settlementId,
      tradeId,
      buyerId,
      sellerId,
      amount.toString(),
      fee.toString(),
    );

    this.logger.log(`정산 블록체인 기록: ${settlementId}`);
    return result;
  }

  async confirmSettlementOnChain(settlementId: string): Promise<void> {
    await this.blockchainService.submitTransaction(
      this.settlementChaincode,
      'ConfirmPayment',
      settlementId,
    );
  }

  // ========== Metering ==========

  async recordMeterData(
    recordId: string,
    userId: string,
    deviceId: string,
    production: number,
    consumption: number,
    source: string,
    timestamp: string,
    dataHash: string,
  ): Promise<string> {
    const result = await this.blockchainService.submitTransaction(
      this.meteringChaincode,
      'RecordMeter',
      recordId,
      userId,
      deviceId,
      production.toString(),
      consumption.toString(),
      source,
      timestamp,
      dataHash,
    );

    this.logger.log(`미터링 블록체인 기록: ${recordId} (device: ${deviceId})`);
    return result;
  }

  async verifyMeterData(
    recordId: string,
    expectedHash: string,
  ): Promise<boolean> {
    const result = await this.blockchainService.evaluateTransaction(
      this.meteringChaincode,
      'VerifyMeterData',
      recordId,
      expectedHash,
    );
    return JSON.parse(result);
  }
}
