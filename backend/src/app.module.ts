import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
import { OracleModule } from './oracle/oracle.module';
import { TokenModule } from './token/token.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    CommonModule,
    BlockchainModule,
    AuthModule,
    UsersModule,
    OracleModule,
    TokenModule,
    TradingModule,
    MeteringModule,
    SettlementModule,
    AggregatorModule,
    AnalyticsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
