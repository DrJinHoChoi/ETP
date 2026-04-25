import api from './api';

export const analyticsService = {
  getRE100: (year?: number) =>
    api.get('/analytics/re100', { params: { year } }).then((r) => r.data),

  getCarbonReduction: (year?: number) =>
    api.get('/analytics/carbon', { params: { year } }).then((r) => r.data),

  getPlatformStats: () =>
    api.get('/analytics/platform').then((r) => r.data),

  getMonthlyTrend: (year: number) =>
    api.get(`/analytics/trend/${year}`).then((r) => r.data),
};
