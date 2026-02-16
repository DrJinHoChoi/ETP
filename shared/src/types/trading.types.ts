export enum OrderType {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum TradeStatus {
  MATCHED = 'MATCHED',
  CONFIRMED = 'CONFIRMED',
  SETTLED = 'SETTLED',
  DISPUTED = 'DISPUTED',
  CANCELLED = 'CANCELLED',
}

export enum EnergySource {
  SOLAR = 'SOLAR',
  WIND = 'WIND',
  HYDRO = 'HYDRO',
  BIOMASS = 'BIOMASS',
  GEOTHERMAL = 'GEOTHERMAL',
}

export interface IOrder {
  id: string;
  userId: string;
  type: OrderType;
  energySource: EnergySource;
  quantity: number;       // kWh
  price: number;          // KRW per kWh
  remainingQty: number;   // 미체결 잔량
  status: OrderStatus;
  validFrom: Date;
  validUntil: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateOrderDto {
  type: OrderType;
  energySource: EnergySource;
  quantity: number;
  price: number;
  validFrom: string;
  validUntil: string;
}

export interface ITrade {
  id: string;
  buyOrderId: string;
  sellOrderId: string;
  buyerId: string;
  sellerId: string;
  energySource: EnergySource;
  quantity: number;
  price: number;
  totalAmount: number;
  status: TradeStatus;
  txHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRECCertificate {
  id: string;
  tradeId: string;
  supplierId: string;
  consumerId: string;
  energySource: EnergySource;
  quantity: number;
  issuedAt: Date;
  validUntil: Date;
  txHash: string | null;
}

export interface ITradingStats {
  totalVolume: number;
  totalTrades: number;
  averagePrice: number;
  todayVolume: number;
  todayTrades: number;
}
