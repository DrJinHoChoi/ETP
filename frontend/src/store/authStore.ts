import { create } from 'zustand';
import { authService, type LoginRequest, type RegisterRequest } from '../services/auth.service';

interface DIDCredential {
  did: string;
  publicKey: string;
  status: 'ACTIVE' | 'REVOKED';
  issuedAt: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  organization: string;
  didCredential?: DIDCredential | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  didLogin: (did: string, signature: string) => Promise<void>;
  logout: () => void;
  loadFromStorage: () => void;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,
  error: null,

  login: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authService.login(data);
      localStorage.setItem('token', res.accessToken);
      set({
        user: res.user,
        token: res.accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
      // 프로필 로드 (DID 정보 포함)
      authService.getProfile().then((profile) => {
        set({ user: profile });
      }).catch(() => {});
    } catch (err: any) {
      set({
        error: err.response?.data?.message || '로그인에 실패했습니다',
        isLoading: false,
      });
      throw err;
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authService.register(data);
      localStorage.setItem('token', res.accessToken);
      set({
        user: res.user,
        token: res.accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
      // 프로필 로드 (DID 정보 포함)
      authService.getProfile().then((profile) => {
        set({ user: profile });
      }).catch(() => {});
    } catch (err: any) {
      set({
        error: err.response?.data?.message || '회원가입에 실패했습니다',
        isLoading: false,
      });
      throw err;
    }
  },

  didLogin: async (did, signature) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authService.loginWithDID(did, signature);
      localStorage.setItem('token', res.accessToken);
      set({
        user: res.user,
        token: res.accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
      authService.getProfile().then((profile) => {
        set({ user: profile });
      }).catch(() => {});
    } catch (err: any) {
      set({
        error: err.response?.data?.message || 'DID 인증에 실패했습니다',
        isLoading: false,
      });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadFromStorage: () => {
    const token = localStorage.getItem('token');
    if (token) {
      set({ token, isAuthenticated: true });
      authService
        .getProfile()
        .then((user) => set({ user }))
        .catch(() => {
          localStorage.removeItem('token');
          set({ token: null, isAuthenticated: false });
        });
    }
  },

  refreshProfile: async () => {
    try {
      const profile = await authService.getProfile();
      set({ user: profile });
    } catch {
      // ignore
    }
  },
}));
