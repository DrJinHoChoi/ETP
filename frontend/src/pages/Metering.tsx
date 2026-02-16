import { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { meteringService } from '../services/metering.service';
import { Card, Button, StatCard, Badge } from '../components/ui';
import { useToast } from '../components/ui/Toast';
import { useSocketEvent } from '../hooks/useWebSocket';

interface MeterReading {
  id: string;
  production: number;
  consumption: number;
  source: string;
  deviceId: string;
  timestamp: string;
}

const SOURCE_LABELS: Record<string, string> = { SOLAR: '태양광', WIND: '풍력', HYDRO: '수력', BIOMASS: '바이오매스', GEOTHERMAL: '지열' };
const SOURCE_ICONS: Record<string, string> = { SOLAR: '☀️', WIND: '🌬️', HYDRO: '💧', BIOMASS: '🌿', GEOTHERMAL: '🌋' };

export default function Metering() {
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({
    production: 0,
    consumption: 0,
    source: 'SOLAR',
    deviceId: '',
    timestamp: new Date().toISOString().slice(0, 16),
  });

  useEffect(() => { loadReadings(); }, []);

  const loadReadings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await meteringService.getReadings();
      setReadings(data);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  // WebSocket: 새 미터링 데이터 수신 시 자동 새로고침
  useSocketEvent('meter:reading', (data) => {
    loadReadings();
    if (data?.netEnergy !== undefined) {
      toast('info', `미터링 수신: 순 에너지 ${data.netEnergy.toFixed(1)} kWh`);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await meteringService.createReading({
        ...form,
        timestamp: new Date(form.timestamp).toISOString(),
      });
      setShowForm(false);
      setForm({ production: 0, consumption: 0, source: 'SOLAR', deviceId: '', timestamp: new Date().toISOString().slice(0, 16) });
      toast('success', '미터링 데이터가 성공적으로 전송되었습니다');
      loadReadings();
    } catch (err: any) {
      toast('error', err.response?.data?.message || '미터링 데이터 전송 실패');
    }
  };

  const totalProduction = readings.reduce((s, r) => s + r.production, 0);
  const totalConsumption = readings.reduce((s, r) => s + r.consumption, 0);
  const netEnergy = totalProduction - totalConsumption;

  const chartData = readings.slice(0, 48).reverse().map((r) => ({
    time: new Date(r.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    생산량: r.production,
    소비량: r.consumption,
  }));

  const inputClass = "w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none";

  return (
    <div className="space-y-6 slide-up">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">미터링</h1>
          <p className="text-sm text-gray-500 mt-1">발전/소비 데이터를 실시간으로 모니터링하세요</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} variant={showForm ? 'secondary' : 'primary'}>
          {showForm ? '닫기' : '+ 데이터 전송'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="총 생산량"
          value={`${totalProduction.toLocaleString(undefined, { maximumFractionDigits: 1 })} kWh`}
          subtitle={`${readings.length}건 측정`}
          variant="gradient-green"
          icon={<span className="text-lg">⚡</span>}
        />
        <StatCard
          title="총 소비량"
          value={`${totalConsumption.toLocaleString(undefined, { maximumFractionDigits: 1 })} kWh`}
          icon={<span className="text-lg">🏭</span>}
        />
        <StatCard
          title="순 에너지"
          value={`${netEnergy.toLocaleString(undefined, { maximumFractionDigits: 1 })} kWh`}
          subtitle={netEnergy >= 0 ? '잉여 에너지' : '에너지 부족'}
          variant={netEnergy >= 0 ? 'gradient-green' : undefined}
          icon={<span className="text-lg">{netEnergy >= 0 ? '📈' : '📉'}</span>}
        />
      </div>

      {showForm && (
        <Card title="미터링 데이터 입력" className="animate-in">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">생산량 (kWh)</label>
              <input type="number" min="0" step="0.01" value={form.production || ''} onChange={(e) => setForm((f) => ({ ...f, production: Number(e.target.value) }))} className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">소비량 (kWh)</label>
              <input type="number" min="0" step="0.01" value={form.consumption || ''} onChange={(e) => setForm((f) => ({ ...f, consumption: Number(e.target.value) }))} className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">에너지원</label>
              <select value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} className={inputClass}>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{SOURCE_ICONS[k]} {v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">디바이스 ID</label>
              <input type="text" value={form.deviceId} onChange={(e) => setForm((f) => ({ ...f, deviceId: e.target.value }))} placeholder="METER-001" className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">측정 시간</label>
              <input type="datetime-local" value={form.timestamp} onChange={(e) => setForm((f) => ({ ...f, timestamp: e.target.value }))} className={inputClass} required />
            </div>
            <div className="flex items-end">
              <Button type="submit">전송</Button>
            </div>
          </form>
        </Card>
      )}

      <Card title="시간대별 생산/소비량">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
              <Legend />
              <Line type="monotone" dataKey="생산량" stroke="#22c55e" strokeWidth={2} name="생산량 (kWh)" dot={false} />
              <Line type="monotone" dataKey="소비량" stroke="#3b82f6" strokeWidth={2} name="소비량 (kWh)" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[350px] flex items-center justify-center text-gray-400">
            <div className="text-center">
              <span className="text-3xl block mb-2">📊</span>
              {isLoading ? '로딩 중...' : '미터링 데이터가 없습니다'}
            </div>
          </div>
        )}
      </Card>

      <Card title="최근 미터링 데이터" padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['시간', '에너지원', '디바이스', '생산량', '소비량', '순 에너지'].map((h) => (
                  <th key={h} className={`px-4 py-3 font-semibold text-gray-600 ${['생산량', '소비량', '순 에너지'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-16 text-center text-gray-400">로딩 중...</td></tr>
              ) : readings.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-16 text-center text-gray-400"><span className="text-3xl block mb-2">📋</span>미터링 데이터가 없습니다</td></tr>
              ) : (
                readings.slice(0, 20).map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500">{new Date(r.timestamp).toLocaleString('ko-KR')}</td>
                    <td className="px-4 py-3">{SOURCE_ICONS[r.source]} {SOURCE_LABELS[r.source] || r.source}</td>
                    <td className="px-4 py-3 font-mono text-gray-500 text-xs">{r.deviceId}</td>
                    <td className="px-4 py-3 text-right"><span className="text-green-600 font-medium">{r.production.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></td>
                    <td className="px-4 py-3 text-right"><span className="text-blue-600 font-medium">{r.consumption.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></td>
                    <td className="px-4 py-3 text-right">
                      <Badge variant={r.production - r.consumption >= 0 ? 'success' : 'error'}>
                        {(r.production - r.consumption).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
