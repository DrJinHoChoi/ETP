import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

// Mock auth service
vi.mock('../services/auth.service', () => ({
  authService: {
    login: vi.fn(),
    register: vi.fn(),
    getProfile: vi.fn(),
    loginWithDID: vi.fn(),
  },
}));

import { authService } from '../services/auth.service';

describe('authStore', () => {
  beforeEach(() => {
    // Reset store
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('has correct initial state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('login sets user and token', async () => {
    const mockResponse = {
      accessToken: 'jwt-token-123',
      user: { id: '1', email: 'test@test.com', name: 'Test', role: 'CONSUMER', organization: 'Org' },
    };
    vi.mocked(authService.login).mockResolvedValue(mockResponse);
    vi.mocked(authService.getProfile).mockResolvedValue(mockResponse.user);

    await useAuthStore.getState().login({ email: 'test@test.com', password: 'pass123' });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe('jwt-token-123');
    expect(state.user).toEqual(mockResponse.user);
    expect(localStorage.getItem('token')).toBe('jwt-token-123');
  });

  it('login sets error on failure', async () => {
    vi.mocked(authService.login).mockRejectedValue({
      response: { data: { message: '인증 실패' } },
    });

    await expect(
      useAuthStore.getState().login({ email: 'fail@test.com', password: 'wrong' })
    ).rejects.toBeDefined();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBe('인증 실패');
    expect(state.isLoading).toBe(false);
  });

  it('register sets user and token', async () => {
    const mockResponse = {
      accessToken: 'jwt-reg-token',
      user: { id: '2', email: 'new@test.com', name: 'New User', role: 'SUPPLIER', organization: 'Org' },
    };
    vi.mocked(authService.register).mockResolvedValue(mockResponse);
    vi.mocked(authService.getProfile).mockResolvedValue(mockResponse.user);

    await useAuthStore.getState().register({
      name: 'New User',
      email: 'new@test.com',
      password: 'pass123',
      role: 'SUPPLIER',
      organization: 'Org',
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe('jwt-reg-token');
  });

  it('register sets error on failure', async () => {
    vi.mocked(authService.register).mockRejectedValue({
      response: { data: { message: '이메일 중복' } },
    });

    await expect(
      useAuthStore.getState().register({
        name: 'Test', email: 'dup@test.com', password: 'pass',
        role: 'CONSUMER', organization: 'Org',
      })
    ).rejects.toBeDefined();

    expect(useAuthStore.getState().error).toBe('이메일 중복');
  });

  it('logout clears state and storage', () => {
    useAuthStore.setState({
      user: { id: '1', email: 'a@b.com', name: 'A', role: 'CONSUMER', organization: 'Org' },
      token: 'token123',
      isAuthenticated: true,
    });
    localStorage.setItem('token', 'token123');

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('loadFromStorage loads token and fetches profile', async () => {
    localStorage.setItem('token', 'stored-token');
    const mockProfile = { id: '1', email: 'a@b.com', name: 'A', role: 'CONSUMER', organization: 'Org' };
    vi.mocked(authService.getProfile).mockResolvedValue(mockProfile);

    useAuthStore.getState().loadFromStorage();

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().token).toBe('stored-token');
  });

  it('loadFromStorage does nothing without token', () => {
    localStorage.clear();
    useAuthStore.setState({ token: null, isAuthenticated: false });

    useAuthStore.getState().loadFromStorage();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('didLogin sets user and token', async () => {
    const mockResponse = {
      accessToken: 'did-token',
      user: { id: '3', email: 'did@test.com', name: 'DID User', role: 'CONSUMER', organization: 'Org' },
    };
    vi.mocked(authService.loginWithDID).mockResolvedValue(mockResponse);
    vi.mocked(authService.getProfile).mockResolvedValue(mockResponse.user);

    await useAuthStore.getState().didLogin('did:etp:123', 'sig');

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe('did-token');
  });
});
