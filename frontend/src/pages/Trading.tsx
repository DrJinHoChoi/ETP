import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { tradingService } from '../services/trading.service';
import { useTokenStore } from '../store/tokenStore';
import { Card, Badge, Button, StatCard } from '../components/ui';
import { useToast } from '../components/ui/Toast';
import { useSocketEvent } from '../hooks/useWebSocket';
import { exportToCSV } from '../lib/csv-export';
import { createOrderSchema, type CreateOrderFormData } from '../lib/schemas/trading.schema';
import type { IOrder } from '@etp/shared';

type Order = Pick<IOrder, 'id' | 'type' | 'energySource' | 'quantity' | 'price' | 'remainingQty' | 'paymentCurrency' | 'status'> & {
  createdAt: string;
};

const SOURCE_LABELS: Record<string, string> = { SOLAR: '태양광', WIND: '풍력', HYDRO: '수력', BIOMASS: '바이오매스', GEOTHERMAL: '지열' };
const SOURCE_ICONS: Record<string, string> = { SOLAR: '☀️', WIND: '🌬️', HYDRO: '💧', BIOMASS: '🌿', GEOTHERMAL: '🌋' };
const STATUS_MAP: Record<string, { text: string; variant: 'success' | 'warning' | 'error' | 'info' | 'neutral' }> = {
  PENDING: { text: '대기', variant: 'warning' },
  PARTIALLY_FILLED: { text: '부분체결', variant: 'info' },
  FILLED: { text: '체결완료', variant: 'success' },
  CANCELLED: { text: '취소', variant: 'error' },
  EXPIRED: { text: '만료', variant: 'neutral' },
};

export default function Trading() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [showForm, setShowForm] = useState(false);
  const { availableBalance } = useTokenStore();
  const { toast } = useToast();
  const orderForm = useForm<CreateOrderFormData>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      type: 'BUY', energySource: 'SOLAR', quantity: 0, price: 0,
      paymentCurrency: 'KRW', validFrom: '', validUntil: '',
    },
  });
  const form = orderForm.watch();

  useEffect(() => { loadOrders(); }, []);
  const loadOrders = useCallback(() => {
    tradingService.getOrders().then(setOrders).catch(() => toast('error', '주문 목록 로드 실패'));
  }, [toast]);

  // WebSocket: 주문 상태 변경 / 거래 체결 시 자동 새로고침
  useSocketEvent('order:updated', loadOrders);
  useSocketEvent('trade:matched', (data) => {
    loadOrders();
    toast('success', `거래 체결! ${data.quantity} kWh @ ${data.price}`);
  });

  const handleSubmit = async (data: CreateOrderFormData) => {
    try {
      await tradingService.createOrder(data);
      setShowForm(false);
      orderForm.reset();
      toast('success', '주문이 성공적으로 생성되었습니다');
      loadOrders();
    } catch (err: any) { toast('error', err.response?.data?.message || '주문 생성 실패'); }
  };

  const handleCancel = async (id: string) => {
    try {
      await tradingService.cancelOrder(id);
      toast('info', '주문이 취소되었습니다');
      loadOrders();
    } catch (err: any) { toast('error', err.response?.data?.message || '주문 취소 실패'); }
  };

  const buyOrders = orders.filter((o) => o.type === 'BUY').length;
  const sellOrders = orders.filter((o) => o.type === 'SELL').length;
  const pendingOrders = orders.filter((o) => o.status === 'PENDING').length;
  const epcTotal = form.type === 'BUY' && form.paymentCurrency === 'EPC' ? form.quantity * form.price : 0;
  const inputClass = "w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none";

  return (
    <div className="space-y-6 slide-up">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">전력 거래</h1>
          <p className="text-sm text-gray-500 mt-1">전력 매수/매도 주문을 관리하세요</p>
        </div>
        <div className="flex gap-2">
          {orders.length > 0 && (
            <Button variant="secondary" onClick={() => exportToCSV(orders, [
              { key: 'type', label: '유형', format: (v: string) => v === 'BUY' ? '매수' : '매도' },
              { key: 'energySource', label: '에너지원', format: (v: string) => SOURCE_LABELS[v] || v },
              { key: 'quantity', label: '수량(kWh)' },
              { key: 'price', label: '단가' },
              { key: 'remainingQty', label: '잔량' },
              { key: 'paymentCurrency', label: '결제수단' },
              { key: 'status', label: '상태', format: (v: string) => STATUS_MAP[v]?.text || v },
              { key: 'createdAt', label: '생성일', format: (v: string) => new Date(v).toLocaleDateString('ko-KR') },
            ], '주문내역')}>
              CSV
            </Button>
          )}
          <Button onClick={() => setShowForm(!showForm)} variant={showForm ? 'secondary' : 'primary'}>
            {showForm ? '닫기' : '+ 새 주문'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="총 주문" value={`${orders.length}건`} icon={<span>📋</span>} />
        <StatCard title="매수 주문" value={`${buyOrders}건`} icon={<span>📈</span>} />
        <StatCard title="매도 주문" value={`${sellOrders}건`} icon={<span>📉</span>} />
        <StatCard title="대기 중" value={`${pendingOrders}건`} icon={<span>⏳</span>} />
      </div>

      {showForm && (
        <Card title="주문 생성" className="animate-in">
          <form onSubmit={orderForm.handleSubmit(handleSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">주문 유형</label>
              <div className="grid grid-cols-2 gap-3">
                {(['BUY', 'SELL'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => orderForm.setValue('type', t)}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${form.type === t ? (t === 'BUY' ? 'border-blue-500 bg-blue-50' : 'border-red-500 bg-red-50') : 'border-gray-200 hover:border-gray-300'}`}>
                    <span className="text-xl">{t === 'BUY' ? '📈' : '📉'}</span>
                    <p className="text-sm font-semibold mt-1">{t === 'BUY' ? '매수' : '매도'}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">에너지원</label>
              <select {...orderForm.register('energySource')} className={inputClass}>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{SOURCE_ICONS[k]} {v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">수량 (kWh)</label>
              <input type="number" min="1" {...orderForm.register('quantity', { valueAsNumber: true })} className={inputClass} />
              {orderForm.formState.errors.quantity && <p className="text-xs text-red-500 mt-1">{orderForm.formState.errors.quantity.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">단가 ({form.paymentCurrency === 'EPC' ? 'EPC/kWh' : '원/kWh'})</label>
              <input type="number" min="0" step="0.1" {...orderForm.register('price', { valueAsNumber: true })} className={inputClass} />
              {orderForm.formState.errors.price && <p className="text-xs text-red-500 mt-1">{orderForm.formState.errors.price.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">결제 수단</label>
              <div className="flex bg-gray-100 rounded-lg p-1">
                {(['KRW', 'EPC'] as const).map((c) => (
                  <button key={c} type="button" onClick={() => orderForm.setValue('paymentCurrency', c)}
                    className={`flex-1 px-3 py-2.5 text-sm rounded-lg transition-all ${form.paymentCurrency === c ? 'bg-white shadow-sm font-semibold' : 'text-gray-500'}`}>
                    {c === 'KRW' ? '🇰🇷 KRW' : '🪙 EPC'}
                  </button>
                ))}
              </div>
              {form.paymentCurrency === 'EPC' && (
                <p className="text-xs text-gray-500 mt-1.5">가용: {availableBalance.toLocaleString()} EPC{epcTotal > 0 && ` | 필요: ${epcTotal.toLocaleString()} EPC`}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">유효기간</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="datetime-local" {...orderForm.register('validFrom')} className={inputClass} />
                <input type="datetime-local" {...orderForm.register('validUntil')} className={inputClass} />
              </div>
              {orderForm.formState.errors.validFrom && <p className="text-xs text-red-500 mt-1">{orderForm.formState.errors.validFrom.message}</p>}
              {orderForm.formState.errors.validUntil && <p className="text-xs text-red-500 mt-1">{orderForm.formState.errors.validUntil.message}</p>}
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" size="lg">주문 제출</Button>
            </div>
          </form>
        </Card>
      )}

      <Card title="주문 내역" padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['유형','에너지원','수량','단가','잔량','결제','상태','생성일','작업'].map((h) => (
                  <th key={h} className={`px-4 py-3 font-semibold text-gray-600 ${['수량','단가','잔량'].includes(h) ? 'text-right' : ['결제','상태','작업'].includes(h) ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-16 text-center text-gray-400"><span className="text-3xl block mb-2">📋</span>주문 내역이 없습니다</td></tr>
              ) : orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3"><Badge variant={o.type === 'BUY' ? 'info' : 'error'} dot>{o.type === 'BUY' ? '매수' : '매도'}</Badge></td>
                  <td className="px-4 py-3">{SOURCE_ICONS[o.energySource]} {SOURCE_LABELS[o.energySource]}</td>
                  <td className="px-4 py-3 text-right font-medium">{o.quantity.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">{o.price.toLocaleString()} {o.paymentCurrency === 'EPC' ? 'EPC' : '원'}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{o.remainingQty.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center"><Badge variant={o.paymentCurrency === 'EPC' ? 'primary' : 'neutral'}>{o.paymentCurrency}</Badge></td>
                  <td className="px-4 py-3 text-center"><Badge variant={STATUS_MAP[o.status]?.variant || 'neutral'} dot>{STATUS_MAP[o.status]?.text || o.status}</Badge></td>
                  <td className="px-4 py-3 text-gray-500">{new Date(o.createdAt).toLocaleDateString('ko-KR')}</td>
                  <td className="px-4 py-3 text-center">
                    {o.status === 'PENDING' && <Button variant="ghost" size="sm" onClick={() => handleCancel(o.id)}><span className="text-red-600">취소</span></Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
