import { describe, it, expect, vi, beforeEach } from 'vitest';
import { oracleService } from './oracle.service';
import api from './api';

vi.mock('./api', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('oracleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getLatestPrice calls correct endpoint', async () => {
    const mockData = {
      weightedAvgPrice: 0.085,
      eiaPrice: 0.08,
      entsoePrice: 0.09,
      kpxPrice: 0.085,
      isStale: false,
    };
    (api.get as any).mockResolvedValue({ data: mockData });

    const result = await oracleService.getLatestPrice();
    expect(api.get).toHaveBeenCalledWith('/oracle/price/latest');
    expect(result).toEqual(mockData);
  });

  it('getBasketHistory calls correct endpoint', async () => {
    const mockData = [{ id: '1', weightedAvgPrice: 0.085 }];
    (api.get as any).mockResolvedValue({ data: mockData });

    const result = await oracleService.getBasketHistory();
    expect(api.get).toHaveBeenCalledWith('/oracle/price/history', { params: undefined });
    expect(result).toEqual(mockData);
  });
});
