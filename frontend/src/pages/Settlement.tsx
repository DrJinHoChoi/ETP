import { useEffect, useState, useCallback } from 'react';
import { settlementService } from '../services/settlement.service';
import { Card, Badge, Button, StatCard } from '../components/ui';
import { useToast } from '../components/ui/Toast';
import { useSocketEvent } from '../hooks/useWebSocket';
import { exportToCSV } from '../lib/csv-export';
import type { ISettlement } from '@etp/shared';

/** 프론트 정산 UI에 필요한 확장 필드 */
interface Settlement extends Pick<ISettlement, 'id' | 'tradeId' | 'amount' | 'fee' | 'netAmount' | 'status'> {
  paymentCurrency: string;
  epcPrice: number | null;
  settledAt: string | null;
  createdAt: string;
  trade: {
    id: string;
    energySource: string;
    quantity: number;
    price: number;
  };
}

interface SettlementStats {
  totalSettled: number;
  totalAmount: number;
  totalFee: number;
  totalNetAmount: number;
}

const STATUS_MAP: Record<string, { text: string; variant: 'success' | 'warning' | 'error' | 'info' }> = {
  PENDING: { text: '대기', variant: 'warning' },
  PROCESSING: { text: '처리중', variant: 'info' },
  COMPLETED: { text: '완료', variant: 'success' },
  FAILED: { text: '실패', variant: 'error' },
};

const SOURCE_LABELS: Record<string, string> = { SOLAR: '태양광', WIND: '풍력', HYDRO: '수력', BIOMASS: '바이오매스', GEOTHERMAL: '지열' };
const SOURCE_ICONS: Record<string, string> = { SOLAR: '☀️', WIND: '🌬️', HYDRO: '💧', BIOMASS: '🌿', GEOTHERMAL: '🌋' };

export default function Settlement() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [stats, setStats] = useState<SettlementStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [settList, settStats] = await Promise.all([
        settlementService.getSettlements(),
        settlementService.getStats(),
      ]);
      setSettlements(settList);
      setStats(settStats);
    } catch {
      toast('error', '정산 데이터 로드 실패');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // WebSocket: 정산 완료/실패 시 자동 새로고침
  useSocketEvent('settlement:completed', (data) => {
    loadData();
    if (data?.action === 'confirmed') {
      toast('success', '정산이 완료되었습니다');
    } else if (data?.action === 'failed') {
      toast('error', `정산 실패: ${data.reason || '알 수 없는 오류'}`);
    }
  });

  const handleConfirm = async (id: string) => {
    try {
      await settlementService.confirmSettlement(id);
      toast('success', '정산이 확인되었습니다');
      loadData();
    } catch (err: any) {
      toast('error', err.response?.data?.message || '정산 확인 실패');
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === 'EPC') return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} EPC`;
    return `${amount.toLocaleString()} 원`;
  };

  const completedCount = settlements.filter((s) => s.status === 'COMPLETED').length;
  const pendingCount = settlements.filter((s) => s.status === 'PENDING').length;

  return (
    <div className="space-y-6 slide-up">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">정산</h1>
          <p className="text-sm text-gray-500 mt-1">거래 정산 내역과 수수료를 확인하세요</p>
        </div>
        {settlements.length > 0 && (
          <Button variant="secondary" onClick={() => exportToCSV(settlements, [
            { key: 'id', label: '정산ID', format: (v: string) => v.slice(0, 8) },
            { key: 'tradeId', label: '거래ID', format: (v: string) => v.slice(0, 8) },
            { key: 'amount', label: '총액' },
            { key: 'fee', label: '수수료' },
            { key: 'netAmount', label: '순액' },
            { key: 'paymentCurrency', label: '결제수단' },
            { key: 'status', label: '상태' },
            { key: 'createdAt', label: '일시', format: (v: string) => new Date(v).toLocaleDateString('ko-KR') },
          ], '정산내역')}>
            CSV
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="정산 건수"
          value={`${stats?.totalSettled || 0}건`}
          subtitle={`대기 ${pendingCount}건`}
          icon={<span className="text-lg">📋</span>}
        />
        <StatCard
          title="총 정산 금액"
          value={`${(stats?.totalAmount || 0).toLocaleString()} 원`}
          variant="gradient-green"
          icon={<span className="text-lg">💰</span>}
        />
        <StatCard
          title="총 수수료"
          value={`${(stats?.totalFee || 0).toLocaleString()} 원`}
          subtitle="플랫폼 수수료 2%"
          icon={<span className="text-lg">🏷️</span>}
        />
        <StatCard
          title="총 실수령액"
          value={`${(stats?.totalNetAmount || 0).toLocaleString()} 원`}
          subtitle={`완료 ${completedCount}건`}
          variant="gradient-indigo"
          icon={<span className="text-lg">💎</span>}
        />
      </div>

      <Card title="정산 내역" padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['거래 ID', '에너지원', '수량', '금액', '수수료', '실수령액', '결제', '상태', '작업'].map((h) => (
                  <th key={h} className={`px-4 py-3 font-semibold text-gray-600 ${['수량', '금액', '수수료', '실수령액'].includes(h) ? 'text-right' : ['결제', '상태', '작업'].includes(h) ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={9} className="px-4 py-16 text-center text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-200 border-t-primary-600" />
                    로딩 중...
                  </div>
                </td></tr>
              ) : settlements.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-16 text-center text-gray-400"><span className="text-3xl block mb-2">📋</span>정산 내역이 없습니다</td></tr>
              ) : (
                settlements.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.tradeId.slice(0, 8)}...</td>
                    <td className="px-4 py-3">{SOURCE_ICONS[s.trade.energySource]} {SOURCE_LABELS[s.trade.energySource] || s.trade.energySource}</td>
                    <td className="px-4 py-3 text-right font-medium">{s.trade.quantity.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(s.amount, s.paymentCurrency)}</td>
                    <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(s.fee, s.paymentCurrency)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(s.netAmount, s.paymentCurrency)}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={s.paymentCurrency === 'EPC' ? 'primary' : 'neutral'}>{s.paymentCurrency}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={STATUS_MAP[s.status]?.variant || 'neutral'} dot>
                        {STATUS_MAP[s.status]?.text || s.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.status === 'PENDING' && (
                        <Button variant="ghost" size="sm" onClick={() => handleConfirm(s.id)}>
                          <span className="text-primary-600 font-medium">확인</span>
                        </Button>
                      )}
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
