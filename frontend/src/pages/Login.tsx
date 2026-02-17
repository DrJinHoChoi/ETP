import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/auth.service';
import { loginSchema, registerSchema, type LoginFormData, type RegisterFormData } from '../lib/schemas/auth.schema';

type AuthTab = 'login' | 'register' | 'did';

export default function Login() {
  const navigate = useNavigate();
  const { login, register: authRegister, didLogin, isLoading, error } = useAuthStore();
  const [activeTab, setActiveTab] = useState<AuthTab>('login');

  // Login form
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Register form
  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', role: 'CONSUMER', organization: '' },
  });

  // DID login state (kept as useState - simpler for multi-step flow)
  const [didForm, setDidForm] = useState({ did: '', signature: '' });
  const [challenge, setChallenge] = useState<{ challenge: string; expiresAt: string } | null>(null);
  const [didLoading, setDidLoading] = useState(false);
  const [didError, setDidError] = useState<string | null>(null);

  const handleLoginSubmit = async (data: LoginFormData) => {
    try {
      await login(data);
      navigate('/');
    } catch {
      // error is handled in store
    }
  };

  const handleRegisterSubmit = async (data: RegisterFormData) => {
    try {
      await authRegister(data);
      navigate('/');
    } catch {
      // error is handled in store
    }
  };

  const handleRequestChallenge = async () => {
    if (!didForm.did.trim()) return;
    setDidLoading(true);
    setDidError(null);
    try {
      const result = await authService.requestDIDChallenge(didForm.did);
      setChallenge(result);
    } catch (err: any) {
      setDidError(err.response?.data?.message || '챌린지 요청에 실패했습니다');
    } finally {
      setDidLoading(false);
    }
  };

  const handleDIDLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!didForm.did || !didForm.signature) return;
    try {
      await didLogin(didForm.did, didForm.signature);
      navigate('/');
    } catch {
      // error handled in store
    }
  };

  const handleTabChange = (tab: AuthTab) => {
    setActiveTab(tab);
    setChallenge(null);
    setDidError(null);
    loginForm.clearErrors();
    registerForm.clearErrors();
  };

  const inputClass = 'w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow';
  const errorClass = 'text-xs text-red-500 mt-1';

  const tabItems: { key: AuthTab; label: string }[] = [
    { key: 'login', label: '로그인' },
    { key: 'register', label: '회원가입' },
    { key: 'did', label: 'DID 인증' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left side - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">ETP</h1>
              <p className="text-emerald-200 text-sm">Energy Trading Platform</p>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white leading-tight mb-4">
            RE100 전력<br />중개거래 플랫폼
          </h2>
          <p className="text-emerald-100/80 text-lg leading-relaxed max-w-md">
            블록체인 기반 전력 거래, EPC 토큰 결제,
            REC 인증서 관리를 하나의 플랫폼에서.
          </p>

          <div className="mt-12 grid grid-cols-3 gap-4">
            <FeatureChip icon="⚡" label="전력 거래" />
            <FeatureChip icon="🪙" label="EPC 토큰" />
            <FeatureChip icon="🌿" label="REC 인증" />
          </div>
        </div>
      </div>

      {/* Right side - form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-2xl font-bold text-gray-900">ETP</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border p-8">
            {/* Tab navigation */}
            <div className="flex border-b mb-6">
              {tabItems.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Login form */}
            {activeTab === 'login' && (
              <>
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-gray-900">로그인</h2>
                  <p className="text-sm text-gray-500 mt-1">계정에 로그인하세요</p>
                </div>

                <form onSubmit={loginForm.handleSubmit(handleLoginSubmit)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
                    <input type="email" {...loginForm.register('email')} placeholder="name@company.com" className={inputClass} />
                    {loginForm.formState.errors.email && <p className={errorClass}>{loginForm.formState.errors.email.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
                    <input type="password" {...loginForm.register('password')} placeholder="••••••••" className={inputClass} />
                    {loginForm.formState.errors.password && <p className={errorClass}>{loginForm.formState.errors.password.message}</p>}
                  </div>

                  {error && <ErrorAlert message={error} />}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-primary-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
                  >
                    {isLoading && <LoadingSpinner />}
                    {isLoading ? '처리 중...' : '로그인'}
                  </button>
                </form>
              </>
            )}

            {/* Register form */}
            {activeTab === 'register' && (
              <>
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-gray-900">회원가입</h2>
                  <p className="text-sm text-gray-500 mt-1">새 계정을 만들어 플랫폼에 참여하세요</p>
                </div>

                <form onSubmit={registerForm.handleSubmit(handleRegisterSubmit)} className="space-y-4">
                  <div className="space-y-4 slide-up">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">이름</label>
                      <input type="text" {...registerForm.register('name')} placeholder="홍길동" className={inputClass} />
                      {registerForm.formState.errors.name && <p className={errorClass}>{registerForm.formState.errors.name.message}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">조직</label>
                      <input type="text" {...registerForm.register('organization')} placeholder="회사명 또는 조직명" className={inputClass} />
                      {registerForm.formState.errors.organization && <p className={errorClass}>{registerForm.formState.errors.organization.message}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">역할</label>
                      <div className="grid grid-cols-2 gap-3">
                        <RoleOption
                          selected={registerForm.watch('role') === 'CONSUMER'}
                          onClick={() => registerForm.setValue('role', 'CONSUMER')}
                          icon="🏢" label="수요자" desc="RE100 참여기업"
                        />
                        <RoleOption
                          selected={registerForm.watch('role') === 'SUPPLIER'}
                          onClick={() => registerForm.setValue('role', 'SUPPLIER')}
                          icon="☀️" label="공급자" desc="발전사업자"
                        />
                      </div>
                      {registerForm.formState.errors.role && <p className={errorClass}>{registerForm.formState.errors.role.message}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
                    <input type="email" {...registerForm.register('email')} placeholder="name@company.com" className={inputClass} />
                    {registerForm.formState.errors.email && <p className={errorClass}>{registerForm.formState.errors.email.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
                    <input type="password" {...registerForm.register('password')} placeholder="대소문자, 숫자, 특수문자 포함 8자 이상" className={inputClass} />
                    {registerForm.formState.errors.password && <p className={errorClass}>{registerForm.formState.errors.password.message}</p>}
                  </div>

                  {error && <ErrorAlert message={error} />}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-primary-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
                  >
                    {isLoading && <LoadingSpinner />}
                    {isLoading ? '처리 중...' : '회원가입'}
                  </button>
                </form>
              </>
            )}

            {/* DID Login */}
            {activeTab === 'did' && (
              <div className="slide-up">
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-gray-900">DID 인증 로그인</h2>
                  <p className="text-sm text-gray-500 mt-1">분산 신원(DID) 기반 챌린지-응답 인증</p>
                </div>

                <form onSubmit={handleDIDLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">DID</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={didForm.did}
                        onChange={(e) => setDidForm((f) => ({ ...f, did: e.target.value }))}
                        placeholder="did:etp:xxxx-xxxx"
                        className={inputClass}
                        required
                      />
                      <button
                        type="button"
                        onClick={handleRequestChallenge}
                        disabled={didLoading || !didForm.did.trim()}
                        className="px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap transition-colors"
                      >
                        {didLoading ? '...' : '챌린지'}
                      </button>
                    </div>
                  </div>

                  {challenge && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 slide-up">
                      <p className="text-xs font-medium text-emerald-700 mb-1">챌린지 (서명 대상)</p>
                      <p className="text-xs font-mono text-emerald-800 break-all bg-emerald-100 p-2 rounded">{challenge.challenge}</p>
                      <p className="text-xs text-emerald-600 mt-1">만료: {new Date(challenge.expiresAt).toLocaleTimeString()}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">서명</label>
                    <textarea
                      value={didForm.signature}
                      onChange={(e) => setDidForm((f) => ({ ...f, signature: e.target.value }))}
                      placeholder="개인키로 챌린지를 서명한 결과를 입력하세요"
                      className={`${inputClass} h-20 resize-none`}
                      required
                    />
                  </div>

                  {(didError || error) && <ErrorAlert message={didError || error || ''} />}

                  <button
                    type="submit"
                    disabled={isLoading || !challenge || !didForm.signature}
                    className="w-full bg-primary-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
                  >
                    {isLoading && <LoadingSpinner />}
                    {isLoading ? '인증 중...' : 'DID 로그인'}
                  </button>
                </form>

                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">
                    <span className="font-medium">인증 절차:</span> DID 입력 → 챌린지 요청 → 개인키로 서명 → 서명 제출
                  </p>
                </div>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            RE100 전력 중개거래 플랫폼 &copy; 2026
          </p>
        </div>
      </div>
    </div>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 p-3 rounded-lg animate-in">
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {message}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function FeatureChip({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white/10 backdrop-blur rounded-lg">
      <span>{icon}</span>
      <span className="text-sm text-white font-medium">{label}</span>
    </div>
  );
}

function RoleOption({ selected, onClick, icon, label, desc }: { selected: boolean; onClick: () => void; icon: string; label: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-3 rounded-lg border-2 text-left transition-all ${
        selected
          ? 'border-primary-500 bg-primary-50'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <span className="text-xl">{icon}</span>
      <p className="text-sm font-semibold text-gray-900 mt-1">{label}</p>
      <p className="text-xs text-gray-500">{desc}</p>
    </button>
  );
}
