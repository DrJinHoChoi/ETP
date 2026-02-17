import { useEffect, useState, useCallback } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import { tradingService } from '../services/trading.service';
import { analyticsService } from '../services/analytics.service';
import { oracleService } from '../services/oracle.service';
import { useTokenStore } from '../store/tokenStore';
import { StatCard, Card } from '../components/ui';
import { useSocketEvent } from '../hooks/useWebSocket';
import { relativeTime } from '../lib/format';
import type { ITradingStats, IPlatformStats, IPriceBasketResponse, IMonthlyTrend, IRecentTrade } from '@etp/shared';

const COLORS = ['#22c55e', '#3b82f6', '#8b5cf6'];
const SOURCE_ICONS: Record<string, string> = { SOLAR: '☀️', WIND: '🌬️', HYDRO: '💧', BIOMASS: '🌿', GEOTHERMAL: '🌋' };

export default function Dashboard() {
  const [stats, setStats] = useState<(ITradingStats & { totalAmount?: number }) | null>(null);
  const [platformStats, setPlatformStats] = useState<IPlatformStats | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<IMonthlyTrend[]>([]);
  const [latestPrice, setLatestPrice] = useState<IPriceBasketResponse | null>(null);
  const [recentTrades, setRecentTrades] = useState<IRecentTrade[]>([]);
  const { balance, lockedBalance, fetchBalance } = useTokenStore();

  const loadStats = useCallback(() => {
    tradingService.getStats().then(setStats).catch(() => {});
    analyticsService.getPlatformStats().then(setPlatformStats).catch(() => {});
  }, []);

  const loadRecentTrades = useCallback(() => {
    tradingService.getRecentTrades(10).then(setRecentTrades).catch(() => {});
  }, []);

  useEffect(() => {
    loadStats();
    loadRecentTrades();
    analyticsService
      .getMonthlyTrend(new Date().getFullYear())
      .then((d: { monthly: IMonthlyTrend[] }) => setMonthlyTrend(d.monthly))
      .catch(() => {});
    oracleService.getLatestPrice().then(setLatestPrice).catch(() => {});
    fetchBalance();
  }, []);

  // WebSocket 실시간 업데이트
  useSocketEvent('trade:matched', () => {
    loadStats();
    loadRecentTrades();
  });
  useSocketEvent('order:updated', loadStats);
  useSocketEvent('price:update', () => {
    oracleService.getLatestPrice().then(setLatestPrice).catch(() => {});
  });
  useSocketEvent('stats:update', (data) => {
    if (data) setStats((prev) => prev ? { ...prev, ...data } : prev);
  });

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
    return `$${(price * 1000).toFixed(2)}`;
  };

  return (
    <div className="space-y-6 slide-up">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">RE100 전력거래 현황을 한눈에 확인하세요</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="EPC 잔액"
          value={`${balance.toLocaleString(undefined, { maximumFractionDigits: 0 })} EPC`}
          subtitle={`잠금: ${lockedBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })} EPC`}
          variant="gradient-green"
          icon={<span className="text-lg">🪙</span>}
        />
        <StatCard
          title="바스켓 가격"
          value={formatPrice(latestPrice?.weightedAvgPrice) + '/MWh'}
          subtitle={`1 EPC = 1 kWh${latestPrice?.isStale ? ' (지연)' : ''}`}
          variant="gradient-indigo"
          icon={<span className="text-lg">🌐</span>}
        />
        <StatCard
          title="총 거래량"
          value={`${(stats?.totalVolume || 0).toLocaleString()} kWh`}
          subtitle={`${stats?.totalTrades || 0}건 체결`}
          icon={<span className="text-lg">⚡</span>}
        />
        <StatCard
          title="오늘 거래량"
          value={`${(stats?.todayVolume || 0).toLocaleString()} kWh`}
          subtitle={`평균 ${(stats?.averagePrice || 0).toFixed(1)} 원/kWh`}
          icon={<span className="text-lg">📈</span>}
        />
      </div>

      {/* Platform Overview */}
      {platformStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MiniCard icon="👥" label="전체 사용자" value={`${platformStats.users.total}명`} color="blue" />
          <MiniCard icon="📋" label="총 주문" value={`${platformStats.orders.total}건`} color="emerald" />
          <MiniCard icon="✅" label="정산 완료" value={`${platformStats.settlements.completed}건`} color="purple" />
          <MiniCard icon="💎" label="플랫폼 수수료" value={`${platformStats.settlements.totalFees.toLocaleString()} 원`} color="amber" />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="월별 거래량 추이" className="lg:col-span-2">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                <Area type="monotone" dataKey="거래량" stroke="#22c55e" strokeWidth={2} fill="url(#colorVolume)" name="거래량 (kWh)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <span className="text-3xl block mb-2">📊</span>
                거래 데이터가 없습니다
              </div>
            </div>
          )}
        </Card>

        <Card title="사용자 구성">
          {roleData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={roleData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {roleData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              <div className="text-center">
                <span className="text-3xl block mb-2">👥</span>
                사용자 데이터가 없습니다
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Recent Trades Feed */}
      <Card title="최근 거래 활동" subtitle="실시간 체결 내역">
        {recentTrades.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {recentTrades.map((trade) => (
              <div key={trade.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{SOURCE_ICONS[trade.energySource] || '⚡'}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {trade.sellerOrg}
                      </span>
                      <span className="text-gray-400 text-xs">&#8594;</span>
                      <span className="text-sm font-medium text-gray-900">
                        {trade.buyerOrg}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {trade.quantity.toLocaleString()} kWh @ {trade.price.toLocaleString()} {trade.paymentCurrency === 'EPC' ? 'EPC' : '원'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {trade.totalAmount.toLocaleString()} {trade.paymentCurrency === 'EPC' ? 'EPC' : '원'}
                  </p>
                  <p className="text-xs text-gray-400">{relativeTime(trade.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <span className="text-3xl block mb-2">📊</span>
            거래 내역이 없습니다
          </div>
        )}
      </Card>

      {/* Price Sources */}
      {latestPrice && (
        <Card title="글로벌 전력 가격 현황" subtitle="3개 소스 가중평균 기반 EPC 가격 산정">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PriceCard country="미국" source="EIA" flag="🇺🇸" price={formatPrice(latestPrice.eiaPrice)} weight="40%" color="blue" />
            <PriceCard country="유럽" source="ENTSO-E" flag="🇪🇺" price={formatPrice(latestPrice.entsoePrice)} weight="35%" color="emerald" />
            <PriceCard country="한국" source="KPX" flag="🇰🇷" price={formatPrice(latestPrice.kpxPrice)} weight="25%" color="orange" />
          </div>
        </Card>
      )}
    </div>
  );
}

function MiniCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  const bg: Record<string, string> = { blue: 'bg-blue-50', emerald: 'bg-emerald-50', purple: 'bg-purple-50', amber: 'bg-amber-50' };
  const iconBg: Record<string, string> = { blue: 'bg-blue-100', emerald: 'bg-emerald-100', purple: 'bg-purple-100', amber: 'bg-amber-100' };
  return (
    <div className={`${bg[color]} p-4 rounded-xl flex items-center gap-3`}>
      <div className={`w-10 h-10 ${iconBg[color]} rounded-lg flex items-center justify-center text-lg`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function PriceCard({ country, source, flag, price, weight, color }: {
  country: string; source: string; flag: string; price: string; weight: string; color: string;
}) {
  const borderColors: Record<string, string> = { blue: 'border-l-blue-500', emerald: 'border-l-emerald-500', orange: 'border-l-orange-500' };
  const textColors: Record<string, string> = { blue: 'text-blue-600', emerald: 'text-emerald-600', orange: 'text-orange-600' };
  const badgeBg: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', emerald: 'bg-emerald-100 text-emerald-700', orange: 'bg-orange-100 text-orange-700' };

  return (
    <div className={`p-4 bg-gray-50 rounded-xl border-l-4 ${borderColors[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{flag}</span>
          <div>
            <p className={`text-sm font-semibold ${textColors[color]}`}>{source}</p>
            <p className="text-xs text-gray-400">{country}</p>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeBg[color]}`}>가중치 {weight}</span>
      </div>
      <p className="text-xl font-bold text-gray-900 mt-2">{price}<span className="text-sm font-normal text-gray-400">/MWh</span></p>
    </div>
  );
}
