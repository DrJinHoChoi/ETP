import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { ToastProvider } from './components/ui/Toast';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Trading = lazy(() => import('./pages/Trading'));
const Metering = lazy(() => import('./pages/Metering'));
const Settlement = lazy(() => import('./pages/Settlement'));
const Wallet = lazy(() => import('./pages/Wallet'));
const PriceOracle = lazy(() => import('./pages/PriceOracle'));
const RECMarketplace = lazy(() => import('./pages/RECMarketplace'));
const Admin = lazy(() => import('./pages/Admin'));
const NotFound = lazy(() => import('./pages/NotFound'));

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
            <Route index element={<RouteErrorBoundary><Suspense fallback={<PageLoader />}><Dashboard /></Suspense></RouteErrorBoundary>} />
            <Route path="trading" element={<RouteErrorBoundary><Suspense fallback={<PageLoader />}><Trading /></Suspense></RouteErrorBoundary>} />
            <Route path="metering" element={<RouteErrorBoundary><Suspense fallback={<PageLoader />}><Metering /></Suspense></RouteErrorBoundary>} />
            <Route path="settlement" element={<RouteErrorBoundary><Suspense fallback={<PageLoader />}><Settlement /></Suspense></RouteErrorBoundary>} />
            <Route path="wallet" element={<RouteErrorBoundary><Suspense fallback={<PageLoader />}><Wallet /></Suspense></RouteErrorBoundary>} />
            <Route path="price-oracle" element={<RouteErrorBoundary><Suspense fallback={<PageLoader />}><PriceOracle /></Suspense></RouteErrorBoundary>} />
            <Route path="rec-marketplace" element={<RouteErrorBoundary><Suspense fallback={<PageLoader />}><RECMarketplace /></Suspense></RouteErrorBoundary>} />
            <Route path="admin" element={<RouteErrorBoundary><Suspense fallback={<PageLoader />}><Admin /></Suspense></RouteErrorBoundary>} />
            <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
