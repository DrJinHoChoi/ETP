import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const navItems = [
  { path: '/', label: '대시보드', icon: '📊' },
  { path: '/trading', label: '전력거래', icon: '⚡' },
  { path: '/metering', label: '미터링', icon: '📈' },
  { path: '/settlement', label: '정산', icon: '💰' },
  { path: '/wallet', label: 'EPC 지갑', icon: '🪙' },
  { path: '/price-oracle', label: '가격 오라클', icon: '🌐' },
  { path: '/rec-marketplace', label: 'REC 마켓', icon: '🌿' },
  { path: '/admin', label: '관리', icon: '⚙️' },
];

export default function Layout() {
  const location = useLocation();
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-primary-600">ETP</span>
              <span className="text-sm text-gray-500">
                RE100 전력 중개거래 플랫폼
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {user?.name} ({user?.organization})
              </span>
              <span className="px-2 py-1 text-xs rounded-full bg-primary-100 text-primary-700">
                {user?.role === 'SUPPLIER'
                  ? '공급자'
                  : user?.role === 'CONSUMER'
                    ? '수요자'
                    : '관리자'}
              </span>
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  location.pathname === item.path
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {item.icon} {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
