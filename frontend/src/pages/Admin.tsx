import { useEffect, useState } from 'react';
import { analyticsService } from '../services/analytics.service';
import { tokenService } from '../services/token.service';
import { Card, Badge, Button, StatCard } from '../components/ui';
import { useToast } from '../components/ui/Toast';

interface PlatformStats {
  users: { total: number; byRole: Record<string, number> };
  orders: { total: number };
  trades: { total: number; totalVolume: number; totalAmount: number; averagePrice: number };
  settlements: { completed: number; totalAmount: number; totalFees: number };
}

const ROLE_LABELS: Record<string, string> = { SUPPLIER: '공급자', CONSUMER: '수요자', ADMIN: '관리자' };

export default function Admin() {
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [mintForm, setMintForm] = useState({ userId: '', amount: 0, reason: '' });
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => { loadStats(); }, []);

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
      toast('success', `${mintForm.amount} EPC 발행이 완료되었습니다`);
      setMintForm({ userId: '', amount: 0, reason: '' });
    } catch (err: any) {
      toast('error', err.response?.data?.message || 'EPC 발행 실패');
    }
  };

  const inputClass = "w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none";

  return (
    <div className="space-y-6 slide-up">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">관리자 패널</h1>
        <p className="text-sm text-gray-500 mt-1">플랫폼 시스템 상태와 통계를 관리하세요</p>
      </div>

      {/* Top Stats */}
      {platformStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="전체 사용자"
            value={`${platformStats.users.total}명`}
            icon={<span className="text-lg">👥</span>}
          />
          <StatCard
            title="총 거래량"
            value={`${platformStats.trades.totalVolume.toLocaleString()} kWh`}
            subtitle={`${platformStats.trades.total}건 체결`}
            variant="gradient-green"
            icon={<span className="text-lg">⚡</span>}
          />
          <StatCard
            title="총 거래액"
            value={`${platformStats.trades.totalAmount.toLocaleString()} 원`}
            subtitle={`평균 ${platformStats.trades.averagePrice.toFixed(1)} 원/kWh`}
            icon={<span className="text-lg">💰</span>}
          />
          <StatCard
            title="플랫폼 수수료"
            value={`${platformStats.settlements.totalFees.toLocaleString()} 원`}
            subtitle={`정산 ${platformStats.settlements.completed}건`}
            variant="gradient-indigo"
            icon={<span className="text-lg">💎</span>}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Status */}
        <Card title="시스템 상태">
          <div className="space-y-3">
            <StatusItem label="백엔드 API" status="online" detail="NestJS v10" />
            <StatusItem label="PostgreSQL" status="online" detail="v17" />
            <StatusItem label="Redis" status="online" detail="캐시/세션" />
            <StatusItem label="Blockchain Network" status="offline" detail="Fabric 2.5" />
            <StatusItem label="가격 오라클" status="online" detail="15분 주기" />
            <StatusItem label="WebSocket" status="online" detail="실시간 이벤트" />
          </div>
        </Card>

        {/* Blockchain Info */}
        <Card title="블록체인 네트워크">
          <div className="space-y-4">
            <InfoRow label="네트워크" value="Hyperledger Fabric 2.5" />
            <InfoRow label="채널" value="trading-channel" />
            <InfoRow label="조직" value="3 (Supplier, Consumer, Admin)" />
            <InfoRow label="체인코드" value="6 (DID, Trading, Settlement, Metering, EPC, REC)" />
            <div className="pt-3 border-t">
              <p className="text-xs font-medium text-gray-500 mb-2">체인코드 목록</p>
              <div className="flex flex-wrap gap-2">
                {['DID', 'Trading', 'Settlement', 'Metering', 'EPC', 'REC Token'].map((cc) => (
                  <Badge key={cc} variant="primary">{cc}</Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Platform Stats Detail */}
        {platformStats && (
          <Card title="플랫폼 상세 통계">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">사용자 구성</p>
                <div className="space-y-2">
                  {Object.entries(platformStats.users.byRole).map(([role, count]) => (
                    <div key={role} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{role === 'SUPPLIER' ? '☀️' : role === 'CONSUMER' ? '🏢' : '⚙️'}</span>
                        <span className="text-sm text-gray-700">{ROLE_LABELS[role] || role}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-100 rounded-full h-2">
                          <div className="bg-primary-500 h-2 rounded-full" style={{ width: `${(count / platformStats.users.total) * 100}%` }} />
                        </div>
                        <span className="text-sm font-medium w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-3 border-t space-y-2">
                <InfoRow label="총 주문" value={`${platformStats.orders.total}건`} />
                <InfoRow label="총 체결" value={`${platformStats.trades.total}건`} />
                <InfoRow label="정산 완료" value={`${platformStats.settlements.completed}건`} />
                <InfoRow label="정산 총액" value={`${platformStats.settlements.totalAmount.toLocaleString()} 원`} />
              </div>
            </div>
          </Card>
        )}

        {/* Admin EPC Mint */}
        <Card title="관리자 EPC 발행" subtitle="테스트 목적 EPC 토큰 수동 발행">
          <form onSubmit={handleMint} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">대상 사용자 ID</label>
              <input
                type="text"
                value={mintForm.userId}
                onChange={(e) => setMintForm((f) => ({ ...f, userId: e.target.value }))}
                placeholder="사용자 UUID"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">발행량 (EPC)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={mintForm.amount || ''}
                onChange={(e) => setMintForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">사유</label>
              <input
                type="text"
                value={mintForm.reason}
                onChange={(e) => setMintForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="발행 사유를 입력하세요"
                className={inputClass}
              />
            </div>
            <Button type="submit" className="w-full" size="lg">🪙 EPC 발행</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function StatusItem({ label, status, detail }: { label: string; status: 'online' | 'offline'; detail?: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <span className={`w-2.5 h-2.5 rounded-full ${status === 'online' ? 'bg-green-500' : 'bg-red-500'} ring-2 ${status === 'online' ? 'ring-green-100' : 'ring-red-100'}`} />
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {detail && <span className="text-xs text-gray-400">{detail}</span>}
        <Badge variant={status === 'online' ? 'success' : 'error'} size="sm">
          {status === 'online' ? '정상' : '미연결'}
        </Badge>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}
