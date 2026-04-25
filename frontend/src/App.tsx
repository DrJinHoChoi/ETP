import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { ToastProvider } from './components/ui/Toast';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Trading = lazy(() => import('./pages/Trading'));
const Metering = lazy(() => import('./pages/Metering'));
const Settlement = lazy(() => import('./pages/Settlement'));
const Wallet = lazy(() => import('./pages/Wallet'));
const PriceOracle = lazy(() => import('./pages/PriceOracle'));
const RECMarketplace = lazy(() => import('./pages/RECMarketplace'));
const Admin = lazy(() => import('./pages/Admin'));

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-200 border-t-primary-600" />
        <p className="text-sm text-gray-400">로딩 중...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
            <Route path="trading" element={<Suspense fallback={<PageLoader />}><Trading /></Suspense>} />
            <Route path="metering" element={<Suspense fallback={<PageLoader />}><Metering /></Suspense>} />
            <Route path="settlement" element={<Suspense fallback={<PageLoader />}><Settlement /></Suspense>} />
            <Route path="wallet" element={<Suspense fallback={<PageLoader />}><Wallet /></Suspense>} />
            <Route path="price-oracle" element={<Suspense fallback={<PageLoader />}><PriceOracle /></Suspense>} />
            <Route path="rec-marketplace" element={<Suspense fallback={<PageLoader />}><RECMarketplace /></Suspense>} />
            <Route path="admin" element={<Suspense fallback={<PageLoader />}><Admin /></Suspense>} />
          </Route>
        </Routes>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
