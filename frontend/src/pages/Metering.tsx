import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { meteringService } from '../services/metering.service';

interface MeterReading {
  id: string;
  production: number;
  consumption: number;
  source: string;
  deviceId: string;
  timestamp: string;
}

export default function Metering() {
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    production: 0,
    consumption: 0,
    source: 'SOLAR',
    deviceId: '',
    timestamp: new Date().toISOString().slice(0, 16),
  });

  useEffect(() => {
    loadReadings();
  }, []);

  const loadReadings = async () => {
    setIsLoading(true);
    try {
      const data = await meteringService.getReadings();
      setReadings(data);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await meteringService.createReading({
        ...form,
        timestamp: new Date(form.timestamp).toISOString(),
      });
      setShowForm(false);
      setForm({ production: 0, consumption: 0, source: 'SOLAR', deviceId: '', timestamp: new Date().toISOString().slice(0, 16) });
      loadReadings();
    } catch (err: any) {
      alert(err.response?.data?.message || '미터링 데이터 전송 실패');
    }
  };

  const totalProduction = readings.reduce((s, r) => s + r.production, 0);
  const totalConsumption = readings.reduce((s, r) => s + r.consumption, 0);

  const chartData = readings.slice(0, 48).reverse().map((r) => ({
    time: new Date(r.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    생산량: r.production,
    소비량: r.consumption,
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">미터링</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          {showForm ? '취소' : '+ 데이터 전송'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">미터링 데이터 입력</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">생산량 (kWh)</label>
              <input type="number" min="0" step="0.01" value={form.production || ''} onChange={(e) => setForm((f) => ({ ...f, production: Number(e.target.value) }))} className="w-full px-3 py-2 border rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">소비량 (kWh)</label>
              <input type="number" min="0" step="0.01" value={form.consumption || ''} onChange={(e) => setForm((f) => ({ ...f, consumption: Number(e.target.value) }))} className="w-full px-3 py-2 border rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">에너지원</label>
              <select value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} className="w-full px-3 py-2 border rounded-lg">
                <option value="SOLAR">태양광</option>
                <option value="WIND">풍력</option>
                <option value="HYDRO">수력</option>
                <option value="BIOMASS">바이오매스</option>
                <option value="GEOTHERMAL">지열</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">디바이스 ID</label>
              <input type="text" value={form.deviceId} onChange={(e) => setForm((f) => ({ ...f, deviceId: e.target.value }))} placeholder="METER-001" className="w-full px-3 py-2 border rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">측정 시간</label>
              <input type="datetime-local" value={form.timestamp} onChange={(e) => setForm((f) => ({ ...f, timestamp: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" required />
            </div>
            <div className="flex items-end">
              <button type="submit" className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700">전송</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">총 생산량</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{totalProduction.toLocaleString(undefined, { maximumFractionDigits: 1 })} kWh</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">총 소비량</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{totalConsumption.toLocaleString(undefined, { maximumFractionDigits: 1 })} kWh</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">순 에너지</p>
          <p className={`text-2xl font-bold mt-1 ${totalProduction - totalConsumption >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {(totalProduction - totalConsumption).toLocaleString(undefined, { maximumFractionDigits: 1 })} kWh
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <h3 className="text-lg font-semibold mb-4">시간대별 생산/소비량</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="생산량" stroke="#22c55e" strokeWidth={2} />
              <Line type="monotone" dataKey="소비량" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-400">
            {isLoading ? '로딩 중...' : '미터링 데이터가 없습니다'}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">최근 미터링 데이터</h3>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">시간</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">디바이스</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">생산량 (kWh)</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">소비량 (kWh)</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">순 에너지 (kWh)</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">로딩 중...</td></tr>
            ) : readings.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">미터링 데이터가 없습니다</td></tr>
            ) : (
              readings.slice(0, 20).map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{new Date(r.timestamp).toLocaleString('ko-KR')}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-500">{r.deviceId}</td>
                  <td className="px-4 py-3 text-sm text-right text-green-600">{r.production.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-sm text-right text-blue-600">{r.consumption.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td className={`px-4 py-3 text-sm text-right ${r.production - r.consumption >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(r.production - r.consumption).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
