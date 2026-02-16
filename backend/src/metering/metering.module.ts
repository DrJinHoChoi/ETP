import { Module } from '@nestjs/common';
import { MeteringService } from './metering.service';
import { MeteringController } from './metering.controller';

@Module({
  controllers: [MeteringController],
  providers: [MeteringService],
  exports: [MeteringService],
})
export class MeteringModule {}
