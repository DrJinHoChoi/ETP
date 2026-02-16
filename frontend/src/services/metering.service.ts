import api from './api';

export const meteringService = {
  getReadings: (params?: { from?: string; to?: string; deviceId?: string }) =>
    api.get('/metering/readings', { params }).then((r) => r.data),

  createReading: (data: {
    production: number;
    consumption: number;
    source: string;
    deviceId: string;
    timestamp: string;
  }) => api.post('/metering/readings', data).then((r) => r.data),

  getAggregation: (params: {
    period: 'HOURLY' | 'DAILY' | 'MONTHLY';
    from: string;
    to: string;
  }) => api.get('/metering/aggregation', { params }).then((r) => r.data),
};
