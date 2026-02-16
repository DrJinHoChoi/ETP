import { useEffect, useState } from 'react';
import { settlementService } from '../services/settlement.service';

interface Settlement {
  id: string;
  tradeId: string;
  amount: number;
  fee: number;
  netAmount: number;
  paymentCurrency: string;
  epcPrice: number | null;
  status: string;
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

const statusLabel: Record<string, { text: string; color: string }> = {
  PENDING: { text: '대기', color: 'bg-yellow-100 text-yellow-700' },
  PROCESSING: { text: '처리중', color: 'bg-blue-100 text-blue-700' },
  COMPLETED: { text: '완료', color: 'bg-green-100 text-green-700' },
  FAILED: { text: '실패', color: 'bg-red-100 text-red-700' },
};

const sourceLabel: Record<string, string> = {
  SOLAR: '태양광',
  WIND: '풍력',
  HYDRO: '수력',
  BIOMASS: '바이오매스',
  GEOTHERMAL: '지열',
};

export default function Settlement() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [stats, setStats] = useState<SettlementStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [settList, settStats] = await Promise.all([
        settlementService.getSettlements(),
        settlementService.getStats(),
      ]);
      setSettlements(settList);
      setStats(settStats);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      await settlementService.confirmSettlement(id);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || '정산 확인 실패');
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === 'EPC') {
      return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} EPC`;
    }
    return `${amount.toLocaleString()} 원`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">정산</h1>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">정산 건수</p>
          <p className="text-2xl font-bold mt-1">
            {stats?.totalSettled || 0}건
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">총 정산 금액</p>
          <p className="text-2xl font-bold mt-1">
            {(stats?.totalAmount || 0).toLocaleString()} 원
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">총 수수료</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">
            {(stats?.totalFee || 0).toLocaleString()} 원
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">총 실수령액</p>
          <p className="text-2xl font-bold text-primary-600 mt-1">
            {(stats?.totalNetAmount || 0).toLocaleString()} 원
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">거래 ID</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">에너지원</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">수량 (kWh)</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">금액</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">수수료</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">실수령액</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">결제</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">상태</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-400">로딩 중...</td>
              </tr>
            ) : settlements.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-400">정산 내역이 없습니다</td>
              </tr>
            ) : (
              settlements.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono">{s.tradeId.slice(0, 8)}...</td>
                  <td className="px-4 py-3 text-sm">{sourceLabel[s.trade.energySource] || s.trade.energySource}</td>
                  <td className="px-4 py-3 text-sm text-right">{s.trade.quantity.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-right">{formatCurrency(s.amount, s.paymentCurrency)}</td>
                  <td className="px-4 py-3 text-sm text-right text-orange-600">{formatCurrency(s.fee, s.paymentCurrency)}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(s.netAmount, s.paymentCurrency)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs rounded-full ${s.paymentCurrency === 'EPC' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                      {s.paymentCurrency}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs rounded-full ${statusLabel[s.status]?.color || 'bg-gray-100'}`}>
                      {statusLabel[s.status]?.text || s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.status === 'PENDING' && (
                      <button onClick={() => handleConfirm(s.id)} className="text-xs text-primary-600 hover:text-primary-800 font-medium">
                        확인
                      </button>
                    )}
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
