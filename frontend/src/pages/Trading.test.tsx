import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '../test/test-utils';
import Trading from './Trading';

// Mock trading service
vi.mock('../services/trading.service', () => ({
  tradingService: {
    getOrders: vi.fn().mockResolvedValue([
      { id: '1', type: 'BUY', energySource: 'SOLAR', quantity: 100, price: 50, remainingQty: 100, paymentCurrency: 'KRW', status: 'PENDING', createdAt: '2024-01-01' },
      { id: '2', type: 'SELL', energySource: 'WIND', quantity: 200, price: 60, remainingQty: 50, paymentCurrency: 'EPC', status: 'FILLED', createdAt: '2024-01-02' },
    ]),
    createOrder: vi.fn().mockResolvedValue({}),
    cancelOrder: vi.fn().mockResolvedValue({}),
  },
}));

// Mock token store
vi.mock('../store/tokenStore', () => ({
  useTokenStore: () => ({ availableBalance: 10000 }),
}));

// Mock WebSocket
vi.mock('../hooks/useWebSocket', () => ({
  useSocketEvent: vi.fn(),
  useWebSocket: () => ({ on: vi.fn(), connected: false }),
}));

// Mock CSV export
vi.mock('../lib/csv-export', () => ({
  exportToCSV: vi.fn(),
}));

describe('Trading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header', async () => {
    renderWithProviders(<Trading />);
    expect(screen.getByText('전력 거래')).toBeInTheDocument();
  });

  it('renders stat cards', async () => {
    renderWithProviders(<Trading />);
    await waitFor(() => {
      expect(screen.getByText('총 주문')).toBeInTheDocument();
      expect(screen.getByText('매수 주문')).toBeInTheDocument();
      expect(screen.getByText('매도 주문')).toBeInTheDocument();
      expect(screen.getByText('대기 중')).toBeInTheDocument();
    });
  });

  it('renders order table', async () => {
    renderWithProviders(<Trading />);
    await waitFor(() => {
      expect(screen.getByText('주문 내역')).toBeInTheDocument();
    });
  });

  it('renders new order button', () => {
    renderWithProviders(<Trading />);
    expect(screen.getByText('+ 새 주문')).toBeInTheDocument();
  });

  it('toggles order form on button click', async () => {
    renderWithProviders(<Trading />);
    fireEvent.click(screen.getByText('+ 새 주문'));
    expect(screen.getByText('주문 생성')).toBeInTheDocument();
  });

  it('shows CSV button when orders exist', async () => {
    renderWithProviders(<Trading />);
    await waitFor(() => {
      expect(screen.getByText('CSV')).toBeInTheDocument();
    });
  });

  it('displays orders from service', async () => {
    renderWithProviders(<Trading />);
    await waitFor(() => {
      // Energy sources are rendered as "☀️ 태양광" with emoji + text, so use regex
      expect(screen.getByText(/태양광/)).toBeInTheDocument();
    });
  });
});
