/** 관리자 플랫폼 통계 응답 */
export interface IPlatformStats {
  users: {
    total: number;
    byRole: Record<string, number>;
  };
  orders: {
    total: number;
  };
  trades: {
    total: number;
    totalVolume: number;
    totalAmount: number;
    averagePrice: number;
  };
  settlements: {
    completed: number;
    totalAmount: number;
    totalFees: number;
  };
}

/** 오라클 최신 바스켓 가격 응답 */
export interface IPriceBasketResponse {
  weightedAvgPrice: number;
  eiaPrice: number | null;
  entsoePrice: number | null;
  kpxPrice: number | null;
  isStale: boolean;
  timestamp?: string;
}

/** 월별 거래 추이 */
export interface IMonthlyTrend {
  month: number;
  tradeCount: number;
  totalVolume: number;
  totalAmount: number;
}

/** 최근 거래 (대시보드 피드) */
export interface IRecentTrade {
  id: string;
  energySource: string;
  quantity: number;
  price: number;
  totalAmount: number;
  paymentCurrency: string;
  buyerOrg: string;
  sellerOrg: string;
  createdAt: string;
}
