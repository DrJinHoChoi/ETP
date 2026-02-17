import { EnergySource } from './trading.types';
import { PaymentCurrency } from './token.types';

/** WebSocket 이벤트 이름 (서버 → 클라이언트) */
export type WebSocketEventName =
  | 'trade:matched'
  | 'order:updated'
  | 'meter:reading'
  | 'settlement:completed'
  | 'stats:update'
  | 'price:update'
  | 'rec:update';

// ─── 이벤트별 Payload ───

export interface ITradeMatchedPayload {
  tradeId: string;
  buyerId: string;
  sellerId: string;
  energySource: EnergySource | string;
  quantity: number;
  price: number;
  totalAmount: number;
  paymentCurrency: PaymentCurrency | string;
}

export interface IOrderUpdatedPayload {
  action: 'created' | 'cancelled' | 'expired' | 'status_changed' | 'admin-cancelled';
  order: {
    id: string;
    type: string;
    status: string;
    remainingQty?: number;
  };
}

export interface IMeterReadingPayload {
  id: string;
  userId: string;
  production: number;
  consumption: number;
  netEnergy: number;
  source: EnergySource | string;
  deviceId: string;
  timestamp: Date | string;
}

export interface ISettlementCompletedPayload {
  action: 'created' | 'confirmed' | 'failed' | 'disputed' | 'dispute-resolved';
  settlementId?: string;
  tradeId?: string;
  resolution?: string;
  reason?: string;
  /** 정산 생성 시 추가 필드 */
  amount?: number;
  fee?: number;
  netAmount?: number;
  paymentCurrency?: string;
  status?: string;
  /** 분쟁 시 추가 필드 */
  disputedBy?: string;
  resolvedBy?: string;
  newTradeStatus?: string;
}

export interface IStatsUpdatePayload {
  totalVolume?: number;
  totalTrades?: number;
  totalAmount?: number;
  averagePrice?: number;
  todayVolume?: number;
  todayTrades?: number;
}

export interface IPriceUpdatePayload {
  weightedAvgPrice: number;
  eiaPrice: number | null | undefined;
  entsoePrice: number | null | undefined;
  kpxPrice: number | null | undefined;
  isStale: boolean;
  timestamp: Date | string;
}

export interface IRECTokenUpdatePayload {
  action: 'issued' | 'transferred' | 'retired' | 'purchased';
  token: Record<string, unknown>;
  buyerId?: string;
  previousOwnerId?: string;
  epcAmount?: number;
}

/** 이벤트명 → Payload 타입 매핑 */
export interface IWebSocketEventMap {
  'trade:matched': ITradeMatchedPayload;
  'order:updated': IOrderUpdatedPayload;
  'meter:reading': IMeterReadingPayload;
  'settlement:completed': ISettlementCompletedPayload;
  'stats:update': IStatsUpdatePayload;
  'price:update': IPriceUpdatePayload;
  'rec:update': IRECTokenUpdatePayload;
}
