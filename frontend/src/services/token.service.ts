import api from './api';

export const tokenService = {
  getBalance: () => api.get('/token/balance').then((r) => r.data),

  getTransactions: (params?: { type?: string; from?: string; to?: string }) =>
    api.get('/token/transactions', { params }).then((r) => r.data),

  transfer: (data: { toUserId: string; amount: number; reason?: string }) =>
    api.post('/token/transfer', data).then((r) => r.data),

  adminMint: (data: { userId: string; amount: number; reason: string }) =>
    api.post('/token/admin/mint', data).then((r) => r.data),
};
