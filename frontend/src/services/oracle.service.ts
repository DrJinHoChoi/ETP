import api from './api';

export const oracleService = {
  getLatestPrice: () => api.get('/oracle/price/latest').then((r) => r.data),

  getBasketHistory: (params?: { from?: string; to?: string }) =>
    api.get('/oracle/price/history', { params }).then((r) => r.data),

  getPriceBySource: (params?: {
    source?: string;
    from?: string;
    to?: string;
  }) => api.get('/oracle/price/source', { params }).then((r) => r.data),

  refreshPrice: () => api.post('/oracle/price/refresh').then((r) => r.data),
};
