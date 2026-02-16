import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TradingModule } from './trading/trading.module';
import { MeteringModule } from './metering/metering.module';
import { SettlementModule } from './settlement/settlement.module';
import { AggregatorModule } from './aggregator/aggregator.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),
    PrismaModule,
    CommonModule,
    BlockchainModule,
    AuthModule,
    UsersModule,
    TradingModule,
    MeteringModule,
    SettlementModule,
    AggregatorModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
