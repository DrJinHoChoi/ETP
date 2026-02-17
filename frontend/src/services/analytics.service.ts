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

  // ─── Admin APIs ───

  getAdminUsers: () =>
    api.get('/users/admin/all').then((r) => r.data),

  updateUser: (id: string, data: { name?: string; organization?: string; status?: string }) =>
    api.patch(`/users/${id}`, data).then((r) => r.data),

  deactivateUser: (id: string) =>
    api.post(`/users/${id}/deactivate`).then((r) => r.data),

  getDisputes: () =>
    api.get('/settlement/disputes').then((r) => r.data),

  resolveDispute: (tradeId: string, resolution: 'REFUND' | 'COMPLETE' | 'CANCEL') =>
    api.post(`/settlement/dispute/${tradeId}/resolve`, { resolution }).then((r) => r.data),

  getAdminOrders: (params?: { status?: string; type?: string }) =>
    api.get('/trading/admin/orders', { params }).then((r) => r.data),

  adminCancelOrder: (orderId: string) =>
    api.post(`/trading/admin/orders/${orderId}/cancel`).then((r) => r.data),
};
