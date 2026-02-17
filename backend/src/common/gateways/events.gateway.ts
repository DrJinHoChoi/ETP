import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/events',
})
export class EventsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** 새 거래 체결 알림 */
  emitTradeMatched(trade: any) {
    this.server.emit('trade:matched', trade);
  }

  /** 주문 상태 변경 알림 */
  emitOrderUpdated(order: any) {
    this.server.emit('order:updated', order);
  }

  /** 미터링 데이터 수신 알림 */
  emitMeterReading(reading: any) {
    this.server.emit('meter:reading', reading);
  }

  /** 정산 완료 알림 */
  emitSettlementCompleted(settlement: any) {
    this.server.emit('settlement:completed', settlement);
  }

  /** 거래 통계 업데이트 */
  emitStatsUpdate(stats: any) {
    this.server.emit('stats:update', stats);
  }

  /** EPC 가격 업데이트 알림 */
  emitPriceUpdate(price: any) {
    this.server.emit('price:update', price);
  }

  /** 토큰 잔액 변경 알림 */
  emitTokenBalanceUpdate(data: {
    userId: string;
    balance: number;
    lockedBalance: number;
  }) {
    this.server.emit('token:balance', data);
  }

  /** REC 토큰 이벤트 */
  emitRECTokenUpdate(data: any) {
    this.server.emit('rec:update', data);
  }
}
