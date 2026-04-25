import api from './api';

export const settlementService = {
  getSettlements: () =>
    api.get('/settlement').then((r) => r.data),

  getStats: () =>
    api.get('/settlement/stats').then((r) => r.data),

  confirmSettlement: (id: string) =>
    api.post(`/settlement/${id}/confirm`).then((r) => r.data),
};
