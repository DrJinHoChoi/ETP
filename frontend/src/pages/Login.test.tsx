import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../test/test-utils';
import Login from './Login';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock auth store
vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    login: vi.fn(),
    register: vi.fn(),
    didLogin: vi.fn(),
    isLoading: false,
    error: null,
  }),
}));

// Mock auth service
vi.mock('../services/auth.service', () => ({
  authService: {
    requestDIDChallenge: vi.fn(),
    loginWithDID: vi.fn(),
  },
}));

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form by default', () => {
    renderWithProviders(<Login />);
    // The page renders the copyright footer and login heading
    expect(screen.getByText(/RE100 전력 중개거래 플랫폼 ©/)).toBeInTheDocument();
  });

  it('renders three auth tabs', () => {
    renderWithProviders(<Login />);
    // Tab buttons exist (로그인 appears as tab and heading, so use getAllByText)
    const loginElements = screen.getAllByText('로그인');
    expect(loginElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('회원가입').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('DID 인증')).toBeInTheDocument();
  });

  it('renders email and password fields', () => {
    renderWithProviders(<Login />);
    expect(screen.getByPlaceholderText('name@company.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });

  it('switches to register tab', () => {
    renderWithProviders(<Login />);
    // Click the 회원가입 tab (first occurrence is the tab button)
    const registerElements = screen.getAllByText('회원가입');
    fireEvent.click(registerElements[0]);
    // Register tab should show name field with placeholder 홍길동
    expect(screen.getByPlaceholderText('홍길동')).toBeInTheDocument();
  });

  it('switches to DID tab', () => {
    renderWithProviders(<Login />);
    fireEvent.click(screen.getByText('DID 인증'));
    expect(screen.getByPlaceholderText(/did:etp/)).toBeInTheDocument();
  });

  it('renders login submit button', () => {
    renderWithProviders(<Login />);
    const buttons = screen.getAllByRole('button');
    const loginBtn = buttons.find(b => b.textContent === '로그인');
    expect(loginBtn).toBeInTheDocument();
  });
});
