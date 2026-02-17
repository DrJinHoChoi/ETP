export enum TokenTxType {
  MINT = 'MINT',
  BURN = 'BURN',
  TRANSFER = 'TRANSFER',
  LOCK = 'LOCK',
  UNLOCK = 'UNLOCK',
}

export enum PriceSource {
  EIA = 'EIA',
  ENTSOE = 'ENTSOE',
  KPX = 'KPX',
}

export enum PaymentCurrency {
  KRW = 'KRW',
  EPC = 'EPC',
}

export enum RECTokenStatus {
  ACTIVE = 'ACTIVE',
  TRANSFERRED = 'TRANSFERRED',
  RETIRED = 'RETIRED',
}

export interface ITokenBalance {
  id: string;
  userId: string;
  balance: number;
  lockedBalance: number;
  updatedAt: Date;
}

export interface ITokenTransaction {
  id: string;
  type: TokenTxType;
  fromId: string | null;
  toId: string | null;
  amount: number;
  reason: string | null;
  refId: string | null;
  txHash: string | null;
  createdAt: Date;
}

export interface IPriceOracle {
  id: string;
  source: PriceSource;
  price: number;
  priceUsd: number;
  currency: string;
  region: string | null;
  timestamp: Date;
}

export interface IPriceBasket {
  id: string;
  weightedAvgPrice: number;
  eiaPrice: number | null;
  eiaWeight: number | null;
  entsoePrice: number | null;
  entsoeWeight: number | null;
  kpxPrice: number | null;
  kpxWeight: number | null;
  isStale: boolean;
  txHash: string | null;
  timestamp: Date;
}

export interface IRECToken {
  id: string;
  certId: string | null;
  tradeId: string | null;
  issuerId: string;
  ownerId: string;
  energySource: string;
  quantity: number;
  vintage: string;
  location: string | null;
  status: RECTokenStatus;
  issuedAt: Date;
  validUntil: Date;
  retiredAt: Date | null;
  retiredBy: string | null;
  txHash: string | null;
}

export interface IEPCStats {
  totalSupply: number;
  totalMinted: number;
  totalBurned: number;
  currentPrice: number;
}
