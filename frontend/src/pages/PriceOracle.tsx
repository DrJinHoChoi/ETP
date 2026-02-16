import { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import { oracleService } from '../services/oracle.service';
import { Card, Badge, StatCard } from '../components/ui';
import { useSocketEvent } from '../hooks/useWebSocket';

interface PriceBasket {
  id: string;
  weightedAvgPrice: number;
  eiaPrice: number | null;
  entsoePrice: number | null;
  kpxPrice: number | null;
  isStale: boolean;
  timestamp: string;
}

export default function PriceOracle() {
  const [latestPrice, setLatestPrice] = useState<PriceBasket | null>(null);
  const [history, setHistory] = useState<PriceBasket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [latest, hist] = await Promise.all([
        oracleService.getLatestPrice(),
        oracleService.getBasketHistory(),
      ]);
      setLatestPrice(latest);
      setHistory(hist.slice(0, 96).reverse());
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Fallback polling (WebSocket이 연결되지 않을 때 대비)
    const interval = setInterval(loadData, 120000);
    return () => clearInterval(interval);
  }, [loadData]);

  // WebSocket: 가격 업데이트 시 즉시 반영 (polling 보완)
  useSocketEvent('price:update', loadData);

  const chartData = history.map((p) => ({
    time: new Date(p.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    basket: p.weightedAvgPrice ? +(p.weightedAvgPrice * 1000).toFixed(3) : null,
    eia: p.eiaPrice ? +(p.eiaPrice * 1000).toFixed(3) : null,
    entsoe: p.entsoePrice ? +(p.entsoePrice * 1000).toFixed(3) : null,
    kpx: p.kpxPrice ? +(p.kpxPrice * 1000).toFixed(3) : null,
  }));

  const formatPrice = (price: number | null | undefined) => {
    if (!price) return '-';
    return `$${(price * 1000).toFixed(3)}`;
  };

  return (
    <div className="space-y-6 slide-up">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">글로벌 전력 가격 오라클</h1>
          <p className="text-sm text-gray-500 mt-1">EPC 토큰의 법정화폐 가치를 결정하는 글로벌 전력 가격</p>
        </div>
        <div className="flex items-center gap-2">
          {latestPrice?.isStale && (
            <Badge variant="warning" dot>데이터 지연</Badge>
          )}
          <Badge variant="success" dot>실시간</Badge>
        </div>
      </div>

      {/* Price Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="바스켓 평균 가격"
          value={isLoading ? '...' : `${formatPrice(latestPrice?.weightedAvgPrice)}/MWh`}
          subtitle="1 EPC = 1 kWh"
          variant="gradient-indigo"
          icon={<span className="text-lg">🌐</span>}
        />
        <PriceSourceCard
          flag="🇺🇸"
          country="미국"
          source="EIA"
          price={formatPrice(latestPrice?.eiaPrice)}
          weight="40%"
          color="blue"
        />
        <PriceSourceCard
          flag="🇪🇺"
          country="유럽"
          source="ENTSO-E"
          price={formatPrice(latestPrice?.entsoePrice)}
          weight="35%"
          color="emerald"
        />
        <PriceSourceCard
          flag="🇰🇷"
          country="한국"
          source="KPX"
          price={formatPrice(latestPrice?.kpxPrice)}
          weight="25%"
          color="orange"
        />
      </div>

      {/* Price Chart */}
      <Card title="가격 추이 ($/MWh)" subtitle="최근 24시간">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorBasket" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
              <Legend />
              <Area type="monotone" dataKey="basket" name="바스켓 평균" stroke="#6366f1" strokeWidth={3} fill="url(#colorBasket)" dot={false} />
              <Line type="monotone" dataKey="eia" name="EIA (US)" stroke="#3b82f6" strokeWidth={1} dot={false} strokeDasharray="5 5" />
              <Line type="monotone" dataKey="entsoe" name="ENTSO-E (EU)" stroke="#22c55e" strokeWidth={1} dot={false} strokeDasharray="5 5" />
              <Line type="monotone" dataKey="kpx" name="KPX (KR)" stroke="#f97316" strokeWidth={1} dot={false} strokeDasharray="5 5" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-gray-400">
            <div className="text-center">
              <span className="text-3xl block mb-2">📈</span>
              {isLoading ? '로딩 중...' : '아직 가격 데이터가 없습니다'}
            </div>
          </div>
        )}
      </Card>

      {/* Info Box */}
      <Card>
        <div className="flex gap-4 items-start">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-lg shrink-0">💡</div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">EPC 가치 결정 방식</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              1 EPC = 1 kWh 수량 기반 페깅. 법정화폐 가치는 글로벌 전력 가격 바스켓
              (US 40%, EU 35%, KR 25% 가중 평균)에 의해 결정됩니다. 가격은 15분마다 업데이트됩니다.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function PriceSourceCard({ flag, country, source, price, weight, color }: {
  flag: string; country: string; source: string; price: string; weight: string; color: string;
}) {
  const borderColors: Record<string, string> = { blue: 'border-l-blue-500', emerald: 'border-l-emerald-500', orange: 'border-l-orange-500' };
  const textColors: Record<string, string> = { blue: 'text-blue-600', emerald: 'text-emerald-600', orange: 'text-orange-600' };
  const badgeBg: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', emerald: 'bg-emerald-100 text-emerald-700', orange: 'bg-orange-100 text-orange-700' };

  return (
    <div className={`bg-white p-5 rounded-xl shadow-sm border border-l-4 ${borderColors[color]}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{flag}</span>
          <div>
            <p className={`text-sm font-semibold ${textColors[color]}`}>{source}</p>
            <p className="text-xs text-gray-400">{country}</p>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeBg[color]}`}>{weight}</span>
      </div>
      <p className="text-xl font-bold text-gray-900">{price}<span className="text-sm font-normal text-gray-400">/MWh</span></p>
    </div>
  );
}
