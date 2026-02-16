import { useEffect, useState } from 'react';
import { analyticsService } from '../services/analytics.service';
import { tokenService } from '../services/token.service';

interface PlatformStats {
  users: { total: number; byRole: Record<string, number> };
  orders: { total: number };
  trades: { total: number; totalVolume: number; totalAmount: number; averagePrice: number };
  settlements: { completed: number; totalAmount: number; totalFees: number };
}

export default function Admin() {
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [mintForm, setMintForm] = useState({ userId: '', amount: 0, reason: '' });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const stats = await analyticsService.getPlatformStats();
      setPlatformStats(stats);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await tokenService.adminMint(mintForm);
      alert(`${mintForm.amount} EPC 발행 완료`);
      setMintForm({ userId: '', amount: 0, reason: '' });
    } catch (err: any) {
      alert(err.response?.data?.message || 'EPC 발행 실패');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">관리</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* System Status */}
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">시스템 상태</h3>
          <div className="space-y-3">
            <StatusItem label="백엔드 API" status="online" />
            <StatusItem label="PostgreSQL" status="online" />
            <StatusItem label="Redis" status="online" />
            <StatusItem label="Blockchain Network" status="offline" />
            <StatusItem label="가격 오라클" status="online" />
          </div>
        </div>

        {/* Blockchain Info */}
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">블록체인 네트워크</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">네트워크</span>
              <span>Hyperledger Fabric 2.5</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">채널</span>
              <span>trading-channel</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">조직</span>
              <span>3 (Supplier, Consumer, Admin)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">체인코드</span>
              <span>6 (DID, Trading, Settlement, Metering, EPC, REC)</span>
            </div>
          </div>
        </div>

        {/* Platform Stats */}
        {platformStats && (
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="text-lg font-semibold mb-4">플랫폼 통계</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">전체 사용자</span>
                <span className="font-medium">{platformStats.users.total}명</span>
              </div>
              {Object.entries(platformStats.users.byRole).map(([role, count]) => (
                <div key={role} className="flex justify-between pl-4">
                  <span className="text-gray-400">
                    {role === 'SUPPLIER' ? '공급자' : role === 'CONSUMER' ? '수요자' : '관리자'}
                  </span>
                  <span>{count}명</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t">
                <span className="text-gray-500">총 주문</span>
                <span className="font-medium">{platformStats.orders.total}건</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">총 체결</span>
                <span className="font-medium">{platformStats.trades.total}건</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">총 거래량</span>
                <span className="font-medium">{platformStats.trades.totalVolume.toLocaleString()} kWh</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">총 거래액</span>
                <span className="font-medium">{platformStats.trades.totalAmount.toLocaleString()} 원</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="text-gray-500">정산 완료</span>
                <span className="font-medium">{platformStats.settlements.completed}건</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">누적 수수료</span>
                <span className="font-medium text-orange-600">{platformStats.settlements.totalFees.toLocaleString()} 원</span>
              </div>
            </div>
          </div>
        )}

        {/* Admin EPC Mint */}
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">관리자 EPC 발행</h3>
          <form onSubmit={handleMint} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">대상 사용자 ID</label>
              <input
                type="text"
                value={mintForm.userId}
                onChange={(e) => setMintForm((f) => ({ ...f, userId: e.target.value }))}
                placeholder="사용자 UUID"
                className="w-full px-3 py-2 border rounded-lg text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">발행량 (EPC)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={mintForm.amount || ''}
                onChange={(e) => setMintForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">사유</label>
              <input
                type="text"
                value={mintForm.reason}
                onChange={(e) => setMintForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="발행 사유"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <button type="submit" className="w-full bg-primary-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-700">
              EPC 발행
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function StatusItem({ label, status }: { label: string; status: 'online' | 'offline' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="flex items-center gap-2 text-sm">
        <span className={`w-2 h-2 rounded-full ${status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
        {status === 'online' ? '정상' : '미연결'}
      </span>
    </div>
  );
}
