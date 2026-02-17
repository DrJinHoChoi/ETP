import api from './api';

export const recTokenService = {
  getMyTokens: (status?: string) =>
    api.get('/rec-token', { params: { status } }).then((r) => r.data),

  getMarketplace: (params?: { energySource?: string; minQty?: number }) =>
    api.get('/rec-token/marketplace', { params }).then((r) => r.data),

  getToken: (id: string) => api.get(`/rec-token/${id}`).then((r) => r.data),

  transfer: (id: string, toUserId: string) =>
    api.post(`/rec-token/${id}/transfer`, { toUserId }).then((r) => r.data),

  retire: (id: string) => api.post(`/rec-token/${id}/retire`).then((r) => r.data),

  issueFromCert: (certId: string) =>
    api.post(`/rec-token/issue/${certId}`).then((r) => r.data),

  purchaseToken: (tokenId: string, epcAmount: number) =>
    api.post(`/rec-token/${tokenId}/purchase`, { epcAmount }).then((r) => r.data),
};
