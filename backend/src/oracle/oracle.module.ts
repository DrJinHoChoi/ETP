import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { OracleService } from './oracle.service';
import { OracleController } from './oracle.controller';
import { EIAProvider } from './providers/eia.provider';
import { ENTSOEProvider } from './providers/entsoe.provider';
import { KPXProvider } from './providers/kpx.provider';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [OracleController],
  providers: [OracleService, EIAProvider, ENTSOEProvider, KPXProvider],
  exports: [OracleService],
})
export class OracleModule {}
