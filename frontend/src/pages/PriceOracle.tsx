import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { oracleService } from '../services/oracle.service';

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

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // 1분마다 갱신
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [latest, hist] = await Promise.all([
        oracleService.getLatestPrice(),
        oracleService.getBasketHistory(),
      ]);
      setLatestPrice(latest);
      setHistory(hist.slice(0, 96).reverse()); // 최근 96개 (24시간)
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const chartData = history.map((p) => ({
    time: new Date(p.timestamp).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    basket: p.weightedAvgPrice ? +(p.weightedAvgPrice * 1000).toFixed(3) : null,
    eia: p.eiaPrice ? +(p.eiaPrice * 1000).toFixed(3) : null,
    entsoe: p.entsoePrice ? +(p.entsoePrice * 1000).toFixed(3) : null,
    kpx: p.kpxPrice ? +(p.kpxPrice * 1000).toFixed(3) : null,
  }));

  const formatPrice = (price: number | null | undefined) => {
    if (!price) return '-';
    return `$${(price * 1000).toFixed(3)}/MWh`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">
          글로벌 전력 가격 오라클
        </h1>
        {latestPrice?.isStale && (
          <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-sm rounded-full">
            데이터 지연 (stale)
          </span>
        )}
      </div>

      {/* Current Price Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white p-6 rounded-xl shadow-lg">
          <p className="text-sm opacity-80">바스켓 평균 가격</p>
          <p className="text-2xl font-bold mt-1">
            {isLoading
              ? '...'
              : formatPrice(latestPrice?.weightedAvgPrice)}
          </p>
          <p className="text-xs opacity-70 mt-1">1 EPC = 1 kWh</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">EIA (미국)</p>
          <p className="text-xl font-bold text-blue-600 mt-1">
            {formatPrice(latestPrice?.eiaPrice)}
          </p>
          <p className="text-xs text-gray-400">USD/MWh</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">ENTSO-E (유럽)</p>
          <p className="text-xl font-bold text-green-600 mt-1">
            {formatPrice(latestPrice?.entsoePrice)}
          </p>
          <p className="text-xs text-gray-400">EUR/MWh 기반</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">KPX (한국)</p>
          <p className="text-xl font-bold text-orange-600 mt-1">
            {formatPrice(latestPrice?.kpxPrice)}
          </p>
          <p className="text-xs text-gray-400">KRW/kWh 기반</p>
        </div>
      </div>

      {/* Price Chart */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">가격 추이 ($/MWh)</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="basket"
                name="바스켓 평균"
                stroke="#6366f1"
                strokeWidth={3}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="eia"
                name="EIA (US)"
                stroke="#3b82f6"
                strokeWidth={1}
                dot={false}
                strokeDasharray="5 5"
              />
              <Line
                type="monotone"
                dataKey="entsoe"
                name="ENTSO-E (EU)"
                stroke="#22c55e"
                strokeWidth={1}
                dot={false}
                strokeDasharray="5 5"
              />
              <Line
                type="monotone"
                dataKey="kpx"
                name="KPX (KR)"
                stroke="#f97316"
                strokeWidth={1}
                dot={false}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-400">
            {isLoading ? '로딩 중...' : '아직 가격 데이터가 없습니다'}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-medium">EPC 가치 결정 방식</p>
        <p className="mt-1">
          1 EPC = 1 kWh 수량 기반 페깅. 법정화폐 가치는 글로벌 전력 가격 바스켓
          (US 40%, EU 35%, KR 25% 가중 평균)에 의해 결정됩니다. 가격은 15분마다
          업데이트됩니다.
        </p>
      </div>
    </div>
  );
}
