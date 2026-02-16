import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { tradingService } from '../services/trading.service';
import { analyticsService } from '../services/analytics.service';
import { oracleService } from '../services/oracle.service';
import { useTokenStore } from '../store/tokenStore';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

interface Stats {
  totalVolume: number;
  totalTrades: number;
  totalAmount: number;
  averagePrice: number;
  todayVolume: number;
  todayTrades: number;
}

interface MonthlyTrend {
  month: number;
  tradeCount: number;
  totalVolume: number;
  totalAmount: number;
}

interface PlatformStats {
  users: { total: number; byRole: Record<string, number> };
  orders: { total: number };
  trades: { total: number; totalVolume: number; totalAmount: number; averagePrice: number };
  settlements: { completed: number; totalAmount: number; totalFees: number };
}

interface PriceBasket {
  weightedAvgPrice: number;
  eiaPrice: number | null;
  entsoePrice: number | null;
  kpxPrice: number | null;
  isStale: boolean;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [latestPrice, setLatestPrice] = useState<PriceBasket | null>(null);
  const { balance, lockedBalance, fetchBalance } = useTokenStore();

  useEffect(() => {
    tradingService.getStats().then(setStats).catch(() => {});
    analyticsService.getPlatformStats().then(setPlatformStats).catch(() => {});
    analyticsService
      .getMonthlyTrend(new Date().getFullYear())
      .then((d: { monthly: MonthlyTrend[] }) => setMonthlyTrend(d.monthly))
      .catch(() => {});
    oracleService.getLatestPrice().then(setLatestPrice).catch(() => {});
    fetchBalance();
  }, []);

  const monthLabels = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

  const chartData = monthlyTrend.map((m) => ({
    month: monthLabels[m.month - 1],
    거래량: m.totalVolume,
    거래건수: m.tradeCount,
  }));

  const roleData = platformStats
    ? Object.entries(platformStats.users.byRole).map(([role, count]) => ({
        name: role === 'SUPPLIER' ? '공급자' : role === 'CONSUMER' ? '수요자' : '관리자',
        value: count,
      }))
    : [];

  const formatPrice = (price: number | null | undefined) => {
    if (!price) return '-';
    return `$${(price * 1000).toFixed(3)}/MWh`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>

      {/* EPC & Price Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-primary-500 to-primary-700 text-white p-6 rounded-xl shadow-lg">
          <p className="text-sm opacity-80">EPC 잔액</p>
          <p className="text-2xl font-bold mt-1">
            {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} EPC
          </p>
          <p className="text-xs opacity-70 mt-1">
            잠금: {lockedBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} EPC
          </p>
        </div>
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white p-6 rounded-xl shadow-lg">
          <p className="text-sm opacity-80">글로벌 전력 바스켓 가격</p>
          <p className="text-2xl font-bold mt-1">{formatPrice(latestPrice?.weightedAvgPrice)}</p>
          <p className="text-xs opacity-70 mt-1">1 EPC = 1 kWh{latestPrice?.isStale && ' (지연)'}</p>
        </div>
        <StatCard title="총 거래량" value={`${(stats?.totalVolume || 0).toLocaleString()} kWh`} sub={`${stats?.totalTrades || 0}건 체결`} />
        <StatCard title="오늘 거래량" value={`${(stats?.todayVolume || 0).toLocaleString()} kWh`} sub={`평균 ${(stats?.averagePrice || 0).toFixed(1)} 원/kWh`} />
      </div>

      {/* Platform Overview */}
      {platformStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MiniCard label="전체 사용자" value={`${platformStats.users.total}명`} />
          <MiniCard label="총 주문" value={`${platformStats.orders.total}건`} />
          <MiniCard label="정산 완료" value={`${platformStats.settlements.completed}건`} />
          <MiniCard label="플랫폼 수수료" value={`${platformStats.settlements.totalFees.toLocaleString()} 원`} />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">월별 거래량 추이</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="거래량" fill="#3b82f6" name="거래량 (kWh)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">거래 데이터가 없습니다</div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">사용자 구성</h3>
          {roleData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={roleData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {roleData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">사용자 데이터가 없습니다</div>
          )}
        </div>
      </div>

      {/* Price Sources */}
      {latestPrice && (
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">글로벌 전력 가격 현황</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-600 font-medium">EIA (미국)</p>
              <p className="text-xl font-bold text-blue-800 mt-1">{formatPrice(latestPrice.eiaPrice)}</p>
              <p className="text-xs text-blue-500 mt-1">가중치 40%</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-600 font-medium">ENTSO-E (유럽)</p>
              <p className="text-xl font-bold text-green-800 mt-1">{formatPrice(latestPrice.entsoePrice)}</p>
              <p className="text-xs text-green-500 mt-1">가중치 35%</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-orange-600 font-medium">KPX (한국)</p>
              <p className="text-xl font-bold text-orange-800 mt-1">{formatPrice(latestPrice.kpxPrice)}</p>
              <p className="text-xs text-orange-500 mt-1">가중치 25%</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p className="text-sm text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold mt-1">{value}</p>
    </div>
  );
}
