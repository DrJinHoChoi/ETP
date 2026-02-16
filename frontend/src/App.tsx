import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Trading from './pages/Trading';
import Metering from './pages/Metering';
import Settlement from './pages/Settlement';
import Wallet from './pages/Wallet';
import PriceOracle from './pages/PriceOracle';
import RECMarketplace from './pages/RECMarketplace';
import Admin from './pages/Admin';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  return (
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
        <Route index element={<Dashboard />} />
        <Route path="trading" element={<Trading />} />
        <Route path="metering" element={<Metering />} />
        <Route path="settlement" element={<Settlement />} />
        <Route path="wallet" element={<Wallet />} />
        <Route path="price-oracle" element={<PriceOracle />} />
        <Route path="rec-marketplace" element={<RECMarketplace />} />
        <Route path="admin" element={<Admin />} />
      </Route>
    </Routes>
  );
}

export default App;
