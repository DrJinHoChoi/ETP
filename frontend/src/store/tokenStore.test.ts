import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTokenStore } from './tokenStore';

vi.mock('../services/token.service', () => ({
  tokenService: {
    getBalance: vi.fn().mockResolvedValue({
      balance: 100,
      lockedBalance: 20,
      availableBalance: 80,
    }),
  },
}));

describe('tokenStore', () => {
  beforeEach(() => {
    useTokenStore.setState({
      balance: 0,
      lockedBalance: 0,
      availableBalance: 0,
      isLoading: false,
    });
  });

  it('should have initial state', () => {
    const state = useTokenStore.getState();
    expect(state.balance).toBe(0);
    expect(state.lockedBalance).toBe(0);
    expect(state.availableBalance).toBe(0);
    expect(state.isLoading).toBe(false);
  });

  it('should fetch balance', async () => {
    await useTokenStore.getState().fetchBalance();
    const state = useTokenStore.getState();
    expect(state.balance).toBe(100);
    expect(state.lockedBalance).toBe(20);
    expect(state.availableBalance).toBe(80);
  });
});
