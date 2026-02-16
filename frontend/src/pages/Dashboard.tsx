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
} from 'recharts';
import { tradingService } from '../services/trading.service';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

interface Stats {
  totalVolume: number;
  totalTrades: number;
  totalAmount: number;
  averagePrice: number;
  todayVolume: number;
  todayTrades: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    tradingService.getStats().then(setStats).catch(console.error);
  }, []);

  const mockVolumeData = [
    { month: '1월', 태양광: 4000, 풍력: 2400, 수력: 800 },
    { month: '2월', 태양광: 3000, 풍력: 1398, 수력: 900 },
    { month: '3월', 태양광: 5000, 풍력: 3800, 수력: 1200 },
    { month: '4월', 태양광: 4780, 풍력: 3908, 수력: 1100 },
    { month: '5월', 태양광: 5890, 풍력: 4800, 수력: 1300 },
    { month: '6월', 태양광: 6390, 풍력: 3800, 수력: 1400 },
  ];

  const mockSourceData = [
    { name: '태양광', value: 45 },
    { name: '풍력', value: 30 },
    { name: '수력', value: 15 },
    { name: '바이오매스', value: 7 },
    { name: '지열', value: 3 },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="총 거래량"
          value={`${(stats?.totalVolume || 0).toLocaleString()} kWh`}
          change="+12.5%"
        />
        <StatCard
          title="총 거래 건수"
          value={`${stats?.totalTrades || 0}건`}
          change="+8.2%"
        />
        <StatCard
          title="평균 단가"
          value={`${(stats?.averagePrice || 0).toFixed(1)} 원/kWh`}
          change="-2.1%"
        />
        <StatCard
          title="오늘 거래량"
          value={`${(stats?.todayVolume || 0).toLocaleString()} kWh`}
          change="+5.3%"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">월별 거래량 추이</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mockVolumeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="태양광" fill="#f59e0b" />
              <Bar dataKey="풍력" fill="#3b82f6" />
              <Bar dataKey="수력" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">에너지원별 비율</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={mockSourceData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
              >
                {mockSourceData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  change,
}: {
  title: string;
  value: string;
  change: string;
}) {
  const isPositive = change.startsWith('+');
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      <p
        className={`text-sm mt-2 ${isPositive ? 'text-green-600' : 'text-red-600'}`}
      >
        {change} 전월 대비
      </p>
    </div>
  );
}
