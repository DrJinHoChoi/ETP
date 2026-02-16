import { Module } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { DIDBlockchainService } from './did-blockchain.service';
import { TradingBlockchainService } from './trading-blockchain.service';

@Module({
  providers: [
    BlockchainService,
    DIDBlockchainService,
    TradingBlockchainService,
  ],
  exports: [
    BlockchainService,
    DIDBlockchainService,
    TradingBlockchainService,
  ],
})
export class BlockchainModule {}
