import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const navigate = useNavigate();
  const { login, register, isLoading, error } = useAuthStore();
  const [isRegister, setIsRegister] = useState(false);

  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    role: 'CONSUMER' as 'SUPPLIER' | 'CONSUMER' | 'ADMIN',
    organization: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isRegister) {
        await register(form);
      } else {
        await login({ email: form.email, password: form.password });
      }
      navigate('/');
    } catch {
      // error is handled in store
    }
  };

  const updateForm = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

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
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {isRegister ? '회원가입' : '로그인'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {isRegister ? '새 계정을 만들어 플랫폼에 참여하세요' : '계정에 로그인하세요'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div className="space-y-4 slide-up">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">이름</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => updateForm('name', e.target.value)}
                      placeholder="홍길동"
                      className="w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">조직</label>
                    <input
                      type="text"
                      value={form.organization}
                      onChange={(e) => updateForm('organization', e.target.value)}
                      placeholder="회사명 또는 조직명"
                      className="w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">역할</label>
                    <div className="grid grid-cols-2 gap-3">
                      <RoleOption
                        selected={form.role === 'CONSUMER'}
                        onClick={() => updateForm('role', 'CONSUMER')}
                        icon="🏢"
                        label="수요자"
                        desc="RE100 참여기업"
                      />
                      <RoleOption
                        selected={form.role === 'SUPPLIER'}
                        onClick={() => updateForm('role', 'SUPPLIER')}
                        icon="☀️"
                        label="공급자"
                        desc="발전사업자"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateForm('email', e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => updateForm('password', e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                  required
                  minLength={8}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 p-3 rounded-lg animate-in">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
              >
                {isLoading && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {isLoading ? '처리 중...' : isRegister ? '회원가입' : '로그인'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => setIsRegister(!isRegister)}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                {isRegister ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            RE100 전력 중개거래 플랫폼 &copy; 2026
          </p>
        </div>
      </div>
    </div>
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
