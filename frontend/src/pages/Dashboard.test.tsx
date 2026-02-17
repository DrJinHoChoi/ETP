import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../test/test-utils';
import Dashboard from './Dashboard';

// Mock trading service
vi.mock('../services/trading.service', () => ({
  tradingService: {
    getStats: vi.fn().mockResolvedValue({
      totalVolume: 50000,
      totalTrades: 120,
      averagePrice: 55.5,
      todayVolume: 2000,
      todayTrades: 8,
    }),
    getRecentTrades: vi.fn().mockResolvedValue([
      {
        id: 'trade-1',
        energySource: 'SOLAR',
        quantity: 100,
        price: 50,
        totalAmount: 5000,
        paymentCurrency: 'KRW',
        buyerOrg: 'Buyer Corp',
        sellerOrg: 'Seller Corp',
        createdAt: new Date().toISOString(),
      },
    ]),
  },
}));

// Mock analytics service
vi.mock('../services/analytics.service', () => ({
  analyticsService: {
    getPlatformStats: vi.fn().mockResolvedValue({
      users: { total: 50, byRole: { SUPPLIER: 20, CONSUMER: 25, ADMIN: 5 } },
      orders: { total: 300 },
      trades: { total: 120, totalVolume: 50000, totalAmount: 2750000, averagePrice: 55 },
      settlements: { completed: 80, totalAmount: 2200000, totalFees: 44000 },
    }),
    getMonthlyTrend: vi.fn().mockResolvedValue({ monthly: [] }),
  },
}));

// Mock oracle service
vi.mock('../services/oracle.service', () => ({
  oracleService: {
    getLatestPrice: vi.fn().mockResolvedValue({
      weightedAvgPrice: 0.065,
      eiaPrice: 0.07,
      entsoePrice: 0.06,
      kpxPrice: 0.065,
      isStale: false,
    }),
  },
}));

// Mock token store
vi.mock('../store/tokenStore', () => ({
  useTokenStore: () => ({
    balance: 5000,
    lockedBalance: 500,
    fetchBalance: vi.fn(),
  }),
}));

// Mock WebSocket
vi.mock('../hooks/useWebSocket', () => ({
  useSocketEvent: vi.fn(),
  useWebSocket: () => ({ on: vi.fn(), connected: false }),
}));

// Mock recharts (avoid rendering issues in jsdom)
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Area: () => null,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header', () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByText('대시보드')).toBeInTheDocument();
  });

  it('renders subtitle', () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByText(/RE100 전력거래 현황/)).toBeInTheDocument();
  });

  it('renders EPC balance stat card', async () => {
    renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('EPC 잔액')).toBeInTheDocument();
    });
  });

  it('renders basket price stat card', async () => {
    renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('바스켓 가격')).toBeInTheDocument();
    });
  });

  it('renders total volume stat card', async () => {
    renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('총 거래량')).toBeInTheDocument();
    });
  });

  it('renders today volume stat card', async () => {
    renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('오늘 거래량')).toBeInTheDocument();
    });
  });

  it('renders platform overview mini cards', async () => {
    renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('전체 사용자')).toBeInTheDocument();
      expect(screen.getByText('총 주문')).toBeInTheDocument();
    });
  });

  it('renders recent trades section', async () => {
    renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('최근 거래 활동')).toBeInTheDocument();
    });
  });

  it('renders recent trade entry', async () => {
    renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('Buyer Corp')).toBeInTheDocument();
      expect(screen.getByText('Seller Corp')).toBeInTheDocument();
    });
  });

  it('renders price sources section', async () => {
    renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('글로벌 전력 가격 현황')).toBeInTheDocument();
    });
  });
});
