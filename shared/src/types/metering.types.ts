import { EnergySource } from './trading.types';

export interface IMeterReading {
  id: string;
  userId: string;
  timestamp: Date;
  production: number;    // kWh 생산량
  consumption: number;   // kWh 소비량
  source: EnergySource;
  deviceId: string;
  createdAt: Date;
}

export interface ICreateMeterReadingDto {
  production: number;
  consumption: number;
  source: EnergySource;
  deviceId: string;
  timestamp: string;
}

export interface IMeteringAggregation {
  userId: string;
  period: 'HOURLY' | 'DAILY' | 'MONTHLY';
  startDate: Date;
  endDate: Date;
  totalProduction: number;
  totalConsumption: number;
  netEnergy: number;
}

export enum SettlementStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface ISettlement {
  id: string;
  tradeId: string;
  buyerId: string;
  sellerId: string;
  amount: number;         // KRW
  fee: number;            // 수수료
  netAmount: number;      // 실수령액
  status: SettlementStatus;
  txHash: string | null;
  settledAt: Date | null;
  createdAt: Date;
}

export interface IBlockchainTransaction {
  id: string;
  txHash: string;
  type: 'DID' | 'TRADE' | 'SETTLEMENT' | 'METERING';
  data: Record<string, unknown>;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  createdAt: Date;
}
