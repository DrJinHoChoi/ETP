import { Module } from '@nestjs/common';
import { MeteringService } from './metering.service';
import { MeteringController } from './metering.controller';
import { TokenModule } from '../token/token.module';

@Module({
  imports: [TokenModule],
  controllers: [MeteringController],
  providers: [MeteringService],
  exports: [MeteringService],
})
export class MeteringModule {}
