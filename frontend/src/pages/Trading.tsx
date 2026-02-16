import { useEffect, useState } from 'react';
import { tradingService } from '../services/trading.service';
import { useTokenStore } from '../store/tokenStore';

interface Order {
  id: string;
  type: string;
  energySource: string;
  quantity: number;
  price: number;
  remainingQty: number;
  paymentCurrency: string;
  status: string;
  createdAt: string;
}

const SOURCE_LABELS: Record<string, string> = {
  SOLAR: '태양광',
  WIND: '풍력',
  HYDRO: '수력',
  BIOMASS: '바이오매스',
  GEOTHERMAL: '지열',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: '대기',
  PARTIALLY_FILLED: '부분체결',
  FILLED: '체결완료',
  CANCELLED: '취소',
  EXPIRED: '만료',
};

export default function Trading() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [showForm, setShowForm] = useState(false);
  const { availableBalance } = useTokenStore();
  const [form, setForm] = useState({
    type: 'BUY',
    energySource: 'SOLAR',
    quantity: 0,
    price: 0,
    paymentCurrency: 'KRW',
    validFrom: '',
    validUntil: '',
  });

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = () => {
    tradingService.getOrders().then(setOrders).catch(console.error);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await tradingService.createOrder(form);
      setShowForm(false);
      loadOrders();
    } catch (err: any) {
      alert(err.response?.data?.message || '주문 생성 실패');
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('이 주문을 취소하시겠습니까?')) return;
    try {
      await tradingService.cancelOrder(id);
      loadOrders();
    } catch (err: any) {
      alert(err.response?.data?.message || '주문 취소 실패');
    }
  };

  const epcTotal = form.type === 'BUY' && form.paymentCurrency === 'EPC'
    ? form.quantity * form.price
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">전력 거래</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          {showForm ? '취소' : '+ 새 주문'}
        </button>
      </div>

      {/* Order Form */}
      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">주문 생성</h3>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">주문 유형</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 border rounded-lg">
                <option value="BUY">매수 (구매)</option>
                <option value="SELL">매도 (판매)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">에너지원</label>
              <select value={form.energySource} onChange={(e) => setForm((f) => ({ ...f, energySource: e.target.value }))} className="w-full px-3 py-2 border rounded-lg">
                {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">수량 (kWh)</label>
              <input type="number" min="1" value={form.quantity || ''} onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))} className="w-full px-3 py-2 border rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                단가 ({form.paymentCurrency === 'EPC' ? 'EPC/kWh' : '원/kWh'})
              </label>
              <input type="number" min="0" step="0.1" value={form.price || ''} onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))} className="w-full px-3 py-2 border rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">결제 수단</label>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, paymentCurrency: 'KRW' }))}
                  className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${form.paymentCurrency === 'KRW' ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}
                >
                  KRW (원)
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, paymentCurrency: 'EPC' }))}
                  className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${form.paymentCurrency === 'EPC' ? 'bg-white shadow-sm font-medium text-purple-700' : 'text-gray-500'}`}
                >
                  EPC 토큰
                </button>
              </div>
              {form.paymentCurrency === 'EPC' && (
                <p className="text-xs text-gray-500 mt-1">
                  가용 잔액: {availableBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} EPC
                  {epcTotal > 0 && ` | 필요: ${epcTotal.toLocaleString()} EPC`}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">유효 시작일</label>
              <input type="datetime-local" value={form.validFrom} onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">유효 종료일</label>
              <input type="datetime-local" value={form.validUntil} onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" required />
            </div>
            <div className="flex items-end">
              <button type="submit" className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700">주문 제출</button>
            </div>
          </form>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">유형</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">에너지원</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">수량 (kWh)</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">단가</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">잔량</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">결제</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">상태</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">생성일</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${order.type === 'BUY' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                    {order.type === 'BUY' ? '매수' : '매도'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{SOURCE_LABELS[order.energySource] || order.energySource}</td>
                <td className="px-4 py-3 text-sm text-right">{order.quantity.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-right">
                  {order.price.toLocaleString()} {order.paymentCurrency === 'EPC' ? 'EPC' : '원'}
                </td>
                <td className="px-4 py-3 text-sm text-right">{order.remainingQty.toLocaleString()}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 text-xs rounded-full ${order.paymentCurrency === 'EPC' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                    {order.paymentCurrency}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(order.createdAt).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-4 py-3 text-center">
                  {order.status === 'PENDING' && (
                    <button onClick={() => handleCancel(order.id)} className="text-xs text-red-600 hover:text-red-800 font-medium">
                      취소
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-400">주문 내역이 없습니다</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
