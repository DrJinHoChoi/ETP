import { Module } from '@nestjs/common';
import { TokenService } from './token.service';
import { TokenController } from './token.controller';
import { RECTokenService } from './rec-token.service';
import { RECTokenController } from './rec-token.controller';
import { EPCBlockchainService } from './epc-blockchain.service';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { OracleModule } from '../oracle/oracle.module';

@Module({
  imports: [BlockchainModule, OracleModule],
  controllers: [TokenController, RECTokenController],
  providers: [TokenService, RECTokenService, EPCBlockchainService],
  exports: [TokenService, RECTokenService],
})
export class TokenModule {}
