import api from './api';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role: 'SUPPLIER' | 'CONSUMER' | 'ADMIN';
  organization: string;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    organization: string;
  };
  authMethod?: string;
}

export interface DIDCredential {
  id: string;
  did: string;
  publicKey: string;
  status: 'ACTIVE' | 'REVOKED';
  issuedAt: string;
}

export interface DIDChallenge {
  challenge: string;
  expiresAt: string;
  did: string;
}

export const authService = {
  login: (data: LoginRequest) =>
    api.post<AuthResponse>('/auth/login', data).then((r) => r.data),

  register: (data: RegisterRequest) =>
    api.post<AuthResponse>('/auth/register', data).then((r) => r.data),

  getProfile: () => api.get('/auth/profile').then((r) => r.data),

  // DID 관리
  issueDID: () =>
    api.post<DIDCredential>('/auth/did/issue').then((r) => r.data),

  verifyDID: (did: string) =>
    api.get(`/auth/did/verify/${did}`).then((r) => r.data),

  revokeDID: () =>
    api.delete('/auth/did/revoke').then((r) => r.data),

  // DID 챌린지-응답 인증
  requestDIDChallenge: (did: string) =>
    api.post<DIDChallenge>('/auth/did/challenge', { did }).then((r) => r.data),

  loginWithDID: (did: string, signature: string) =>
    api.post<AuthResponse>('/auth/did/login', { did, signature }).then((r) => r.data),
};
