import { Module } from '@nestjs/common';
import { DemandAggregatorService } from './demand-aggregator.service';
import { SupplyAggregatorService } from './supply-aggregator.service';
import { AggregatorController } from './aggregator.controller';

@Module({
  controllers: [AggregatorController],
  providers: [DemandAggregatorService, SupplyAggregatorService],
  exports: [DemandAggregatorService, SupplyAggregatorService],
})
export class AggregatorModule {}
