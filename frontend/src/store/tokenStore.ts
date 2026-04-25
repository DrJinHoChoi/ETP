import { create } from 'zustand';
import { tokenService } from '../services/token.service';

interface TokenState {
  balance: number;
  lockedBalance: number;
  availableBalance: number;
  isLoading: boolean;
  fetchBalance: () => Promise<void>;
}

export const useTokenStore = create<TokenState>((set) => ({
  balance: 0,
  lockedBalance: 0,
  availableBalance: 0,
  isLoading: false,
  fetchBalance: async () => {
    set({ isLoading: true });
    try {
      const data = await tokenService.getBalance();
      set({
        balance: data.balance,
        lockedBalance: data.lockedBalance,
        availableBalance: data.availableBalance,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },
}));
