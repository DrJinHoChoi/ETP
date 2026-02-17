import api from './api';

export const tradingService = {
  getOrders: (params?: { type?: string; status?: string }) =>
    api.get('/trading/orders', { params }).then((r) => r.data),

  getOrderById: (id: string) =>
    api.get(`/trading/orders/${id}`).then((r) => r.data),

  createOrder: (data: {
    type: string;
    energySource: string;
    quantity: number;
    price: number;
    paymentCurrency?: string;
    validFrom: string;
    validUntil: string;
  }) => api.post('/trading/orders', data).then((r) => r.data),

  cancelOrder: (id: string) =>
    api.delete(`/trading/orders/${id}`).then((r) => r.data),

  getTrades: () => api.get('/trading/trades').then((r) => r.data),

  getStats: () => api.get('/trading/stats').then((r) => r.data),

  getRecentTrades: (limit = 10) =>
    api.get('/trading/trades/recent', { params: { limit } }).then((r) => r.data),
};
