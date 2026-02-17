import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from './auth.service';
import api from './api';

// Mock the api module
vi.mock('./api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('calls POST /auth/login with credentials', async () => {
      const mockResponse = {
        data: {
          accessToken: 'token123',
          user: { id: '1', email: 'a@b.com', name: 'User', role: 'CONSUMER', organization: 'Org' },
        },
      };
      vi.mocked(api.post).mockResolvedValue(mockResponse);

      const result = await authService.login({ email: 'a@b.com', password: 'pass' });

      expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'a@b.com', password: 'pass' });
      expect(result.accessToken).toBe('token123');
    });
  });

  describe('register', () => {
    it('calls POST /auth/register with user data', async () => {
      const mockResponse = {
        data: {
          accessToken: 'token456',
          user: { id: '2', email: 'b@c.com', name: 'New', role: 'SUPPLIER', organization: 'NewOrg' },
        },
      };
      vi.mocked(api.post).mockResolvedValue(mockResponse);

      const result = await authService.register({
        name: 'New', email: 'b@c.com', password: 'pass',
        role: 'SUPPLIER', organization: 'NewOrg',
      });

      expect(api.post).toHaveBeenCalledWith('/auth/register', expect.objectContaining({ email: 'b@c.com' }));
      expect(result.accessToken).toBe('token456');
    });
  });

  describe('getProfile', () => {
    it('calls GET /auth/profile', async () => {
      const mockProfile = { id: '1', email: 'a@b.com', name: 'User' };
      vi.mocked(api.get).mockResolvedValue({ data: mockProfile });

      const result = await authService.getProfile();

      expect(api.get).toHaveBeenCalledWith('/auth/profile');
      expect(result.id).toBe('1');
    });
  });

  describe('issueDID', () => {
    it('calls POST /auth/did/issue', async () => {
      const mockDID = { id: 'did-1', did: 'did:etp:123', publicKey: 'pk', status: 'ACTIVE', issuedAt: '2024-01-01' };
      vi.mocked(api.post).mockResolvedValue({ data: mockDID });

      const result = await authService.issueDID();

      expect(api.post).toHaveBeenCalledWith('/auth/did/issue');
      expect(result.did).toBe('did:etp:123');
    });
  });

  describe('verifyDID', () => {
    it('calls GET /auth/did/verify/:did', async () => {
      vi.mocked(api.get).mockResolvedValue({ data: { valid: true } });

      const result = await authService.verifyDID('did:etp:123');

      expect(api.get).toHaveBeenCalledWith('/auth/did/verify/did:etp:123');
      expect(result.valid).toBe(true);
    });
  });

  describe('revokeDID', () => {
    it('calls DELETE /auth/did/revoke', async () => {
      vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });

      const result = await authService.revokeDID();

      expect(api.delete).toHaveBeenCalledWith('/auth/did/revoke');
      expect(result.success).toBe(true);
    });
  });

  describe('requestDIDChallenge', () => {
    it('calls POST /auth/did/challenge', async () => {
      const mockChallenge = { challenge: 'abc123', expiresAt: '2024-12-31', did: 'did:etp:123' };
      vi.mocked(api.post).mockResolvedValue({ data: mockChallenge });

      const result = await authService.requestDIDChallenge('did:etp:123');

      expect(api.post).toHaveBeenCalledWith('/auth/did/challenge', { did: 'did:etp:123' });
      expect(result.challenge).toBe('abc123');
    });
  });

  describe('loginWithDID', () => {
    it('calls POST /auth/did/login', async () => {
      const mockResponse = {
        accessToken: 'did-token',
        user: { id: '3', email: 'did@test.com', name: 'DID User', role: 'CONSUMER', organization: 'Org' },
      };
      vi.mocked(api.post).mockResolvedValue({ data: mockResponse });

      const result = await authService.loginWithDID('did:etp:123', 'signature');

      expect(api.post).toHaveBeenCalledWith('/auth/did/login', { did: 'did:etp:123', signature: 'signature' });
      expect(result.accessToken).toBe('did-token');
    });
  });
});
