import { Module } from '@nestjs/common';
import { TradingService } from './trading.service';
import { TradingController } from './trading.controller';
import { TokenModule } from '../token/token.module';

@Module({
  imports: [TokenModule],
  controllers: [TradingController],
  providers: [TradingService],
  exports: [TradingService],
})
export class TradingModule {}
