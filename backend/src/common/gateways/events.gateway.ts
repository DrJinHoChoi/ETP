import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import type {
  ITradeMatchedPayload,
  IOrderUpdatedPayload,
  IMeterReadingPayload,
  ISettlementCompletedPayload,
  IStatsUpdatePayload,
  IPriceUpdatePayload,
  IRECTokenUpdatePayload,
} from '@etp/shared';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/events',
})
export class EventsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`인증 토큰 없는 연결 시도: ${client.id}`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET', 'dev-secret'),
      });

      client.data.userId = payload.sub;
      client.data.role = payload.role;
      client.join(`user:${payload.sub}`);

      this.logger.log(`Client connected: ${client.id} (user: ${payload.sub})`);
    } catch (error) {
      this.logger.warn(`WebSocket 인증 실패: ${client.id} - ${(error as Error).message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** 새 거래 체결 알림 */
  emitTradeMatched(trade: ITradeMatchedPayload) {
    this.server.emit('trade:matched', trade);
  }

  /** 주문 상태 변경 알림 */
  emitOrderUpdated(order: IOrderUpdatedPayload) {
    this.server.emit('order:updated', order);
  }

  /** 미터링 데이터 수신 알림 */
  emitMeterReading(reading: IMeterReadingPayload) {
    this.server.emit('meter:reading', reading);
  }

  /** 정산 완료 알림 */
  emitSettlementCompleted(settlement: ISettlementCompletedPayload) {
    this.server.emit('settlement:completed', settlement);
  }

  /** 거래 통계 업데이트 */
  emitStatsUpdate(stats: IStatsUpdatePayload) {
    this.server.emit('stats:update', stats);
  }

  /** EPC 가격 업데이트 알림 */
  emitPriceUpdate(price: IPriceUpdatePayload) {
    this.server.emit('price:update', price);
  }

  /** 토큰 잔액 변경 알림 (사용자별 전송) */
  emitTokenBalanceUpdate(data: {
    userId: string;
    balance: number;
    lockedBalance: number;
  }) {
    this.server.to(`user:${data.userId}`).emit('token:balance', data);
  }

  /** REC 토큰 이벤트 */
  emitRECTokenUpdate(data: IRECTokenUpdatePayload) {
    this.server.emit('rec:update', data);
  }
}
