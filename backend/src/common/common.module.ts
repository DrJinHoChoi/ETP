import { Global, Module } from '@nestjs/common';
import { EventsGateway } from './gateways/events.gateway';

@Global()
@Module({
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class CommonModule {}
