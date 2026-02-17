import { useEffect, useState, useCallback } from 'react';
import { analyticsService } from '../services/analytics.service';
import { tokenService } from '../services/token.service';
import { Card, Badge, Button, StatCard } from '../components/ui';
import { useToast } from '../components/ui/Toast';
import type { IPlatformStats } from '@etp/shared';

type AdminTab = 'stats' | 'users' | 'disputes' | 'orders';

interface AdminUser {
  id: string; email: string; name: string; role: string;
  organization: string; status: string; createdAt: string;
  did: string | null; didStatus: string | null;
  orderCount: number; tradeCount: number;
}

interface DisputeTrade {
  id: string; buyerId: string; sellerId: string; energySource: string;
  quantity: number; price: number; totalAmount: number; status: string;
  createdAt: string; updatedAt: string;
  buyer: { id: string; name: string; email: string; organization: string };
  seller: { id: string; name: string; email: string; organization: string };
  settlement: any;
}

interface AdminOrder {
  id: string; type: string; energySource: string; quantity: number;
  price: number; remainingQty: number; paymentCurrency: string;
  status: string; createdAt: string;
  user: { id: string; name: string; email: string; organization: string; role: string };
}

const ROLE_LABELS: Record<string, string> = { SUPPLIER: '공급자', CONSUMER: '수요자', ADMIN: '관리자' };
const STATUS_LABELS: Record<string, string> = { ACTIVE: '활성', INACTIVE: '비활성', SUSPENDED: '정지' };
const SOURCE_LABELS: Record<string, string> = { SOLAR: '태양광', WIND: '풍력', HYDRO: '수력', BIOMASS: '바이오매스', GEOTHERMAL: '지열' };
const ORDER_STATUS: Record<string, { text: string; variant: 'success' | 'warning' | 'error' | 'info' | 'neutral' }> = {
  PENDING: { text: '대기', variant: 'warning' },
  PARTIALLY_FILLED: { text: '부분체결', variant: 'info' },
  FILLED: { text: '체결완료', variant: 'success' },
  CANCELLED: { text: '취소', variant: 'error' },
  EXPIRED: { text: '만료', variant: 'neutral' },
};

const TAB_ITEMS: { key: AdminTab; label: string; icon: string }[] = [
  { key: 'stats', label: '통계', icon: '📊' },
  { key: 'users', label: '사용자', icon: '👥' },
  { key: 'disputes', label: '분쟁', icon: '⚖️' },
  { key: 'orders', label: '주문', icon: '📋' },
];

export default function Admin() {
  const [activeTab, setActiveTab] = useState<AdminTab>('stats');
  const { toast } = useToast();

  return (
    <div className="space-y-6 slide-up">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">관리자 패널</h1>
        <p className="text-sm text-gray-500 mt-1">플랫폼 시스템 상태와 통계를 관리하세요</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b">
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'stats' && <StatsTab toast={toast} />}
      {activeTab === 'users' && <UsersTab toast={toast} />}
      {activeTab === 'disputes' && <DisputesTab toast={toast} />}
      {activeTab === 'orders' && <OrdersTab toast={toast} />}
    </div>
  );
}

// ─── Stats Tab ───
function StatsTab({ toast }: { toast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void }) {
  const [platformStats, setPlatformStats] = useState<IPlatformStats | null>(null);
  const [mintForm, setMintForm] = useState({ userId: '', amount: 0, reason: '' });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const stats = await analyticsService.getPlatformStats();
      setPlatformStats(stats);
    } catch {
      toast('error', '통계 로드 실패');
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

  if (isLoading) return <div className="text-center py-12 text-gray-500">로딩 중...</div>;

  return (
    <>
      {platformStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="전체 사용자" value={`${platformStats.users.total}명`} icon={<span className="text-lg">👥</span>} />
          <StatCard title="총 거래량" value={`${platformStats.trades.totalVolume.toLocaleString()} kWh`} subtitle={`${platformStats.trades.total}건 체결`} variant="gradient-green" icon={<span className="text-lg">⚡</span>} />
          <StatCard title="총 거래액" value={`${platformStats.trades.totalAmount.toLocaleString()} 원`} subtitle={`평균 ${platformStats.trades.averagePrice.toFixed(1)} 원/kWh`} icon={<span className="text-lg">💰</span>} />
          <StatCard title="플랫폼 수수료" value={`${platformStats.settlements.totalFees.toLocaleString()} 원`} subtitle={`정산 ${platformStats.settlements.completed}건`} variant="gradient-indigo" icon={<span className="text-lg">💎</span>} />
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
        <Card title="관리자 EPC 발행" subtitle="테스트 목적 EPC 토큰 수동 발행">
          <form onSubmit={handleMint} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">대상 사용자 ID</label>
              <input type="text" value={mintForm.userId} onChange={(e) => setMintForm((f) => ({ ...f, userId: e.target.value }))} placeholder="사용자 UUID" className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">발행량 (EPC)</label>
              <input type="number" min="0.01" step="0.01" value={mintForm.amount || ''} onChange={(e) => setMintForm((f) => ({ ...f, amount: Number(e.target.value) }))} className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">사유</label>
              <input type="text" value={mintForm.reason} onChange={(e) => setMintForm((f) => ({ ...f, reason: e.target.value }))} placeholder="발행 사유를 입력하세요" className={inputClass} />
            </div>
            <Button type="submit" className="w-full" size="lg">EPC 발행</Button>
          </form>
        </Card>
      </div>
    </>
  );
}

// ─── Users Tab ───
function UsersTab({ toast }: { toast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await analyticsService.getAdminUsers();
      setUsers(data);
    } catch {
      toast('error', '사용자 목록 로드 실패');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleDeactivate = async (userId: string) => {
    if (!confirm('이 사용자를 비활성화하시겠습니까? DID도 함께 폐기됩니다.')) return;
    try {
      await analyticsService.deactivateUser(userId);
      toast('success', '사용자가 비활성화되었습니다');
      loadUsers();
    } catch (err: any) {
      toast('error', err.response?.data?.message || '비활성화 실패');
    }
  };

  if (isLoading) return <div className="text-center py-12 text-gray-500">로딩 중...</div>;

  return (
    <Card title={`전체 사용자 (${users.length}명)`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-3 font-medium">이름</th>
              <th className="pb-3 font-medium">이메일</th>
              <th className="pb-3 font-medium">역할</th>
              <th className="pb-3 font-medium">조직</th>
              <th className="pb-3 font-medium">상태</th>
              <th className="pb-3 font-medium">DID</th>
              <th className="pb-3 font-medium text-right">주문/거래</th>
              <th className="pb-3 font-medium text-right">작업</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-3 font-medium text-gray-900">{user.name}</td>
                <td className="py-3 text-gray-600">{user.email}</td>
                <td className="py-3"><Badge variant={user.role === 'ADMIN' ? 'info' : 'primary'} size="sm">{ROLE_LABELS[user.role] || user.role}</Badge></td>
                <td className="py-3 text-gray-600">{user.organization}</td>
                <td className="py-3">
                  <Badge variant={user.status === 'ACTIVE' ? 'success' : user.status === 'SUSPENDED' ? 'error' : 'neutral'} size="sm">
                    {STATUS_LABELS[user.status] || user.status}
                  </Badge>
                </td>
                <td className="py-3">
                  {user.did ? (
                    <Badge variant={user.didStatus === 'ACTIVE' ? 'success' : 'error'} size="sm">{user.didStatus}</Badge>
                  ) : (
                    <span className="text-gray-400 text-xs">미발급</span>
                  )}
                </td>
                <td className="py-3 text-right text-gray-600">{user.orderCount} / {user.tradeCount}</td>
                <td className="py-3 text-right">
                  {user.status === 'ACTIVE' && user.role !== 'ADMIN' && (
                    <button onClick={() => handleDeactivate(user.id)} className="text-xs text-red-600 hover:text-red-700 font-medium">
                      정지
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Disputes Tab ───
function DisputesTab({ toast }: { toast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void }) {
  const [disputes, setDisputes] = useState<DisputeTrade[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDisputes = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await analyticsService.getDisputes();
      setDisputes(data);
    } catch {
      toast('error', '분쟁 목록 로드 실패');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadDisputes(); }, [loadDisputes]);

  const handleResolve = async (tradeId: string, resolution: 'REFUND' | 'COMPLETE' | 'CANCEL') => {
    const labels = { REFUND: '환불', COMPLETE: '정산 확정', CANCEL: '거래 취소' };
    if (!confirm(`이 분쟁을 "${labels[resolution]}"로 해결하시겠습니까?`)) return;
    try {
      await analyticsService.resolveDispute(tradeId, resolution);
      toast('success', `분쟁이 "${labels[resolution]}"로 해결되었습니다`);
      loadDisputes();
    } catch (err: any) {
      toast('error', err.response?.data?.message || '분쟁 해결 실패');
    }
  };

  if (isLoading) return <div className="text-center py-12 text-gray-500">로딩 중...</div>;

  if (disputes.length === 0) {
    return (
      <Card title="분쟁 관리">
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-1">⚖️</p>
          <p>현재 진행 중인 분쟁이 없습니다</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-500">분쟁 중 거래 ({disputes.length}건)</h3>
      {disputes.map((d) => (
        <Card key={d.id}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="error">분쟁</Badge>
                <span className="text-sm font-medium">{SOURCE_LABELS[d.energySource] || d.energySource}</span>
                <span className="text-sm text-gray-500">{d.quantity.toLocaleString()} kWh @ {d.price.toLocaleString()}</span>
              </div>
              <span className="text-xs text-gray-400">{new Date(d.updatedAt).toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 text-xs mb-1">매수자</p>
                <p className="font-medium">{d.buyer.name} ({d.buyer.organization})</p>
                <p className="text-gray-400 text-xs">{d.buyer.email}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">매도자</p>
                <p className="font-medium">{d.seller.name} ({d.seller.organization})</p>
                <p className="text-gray-400 text-xs">{d.seller.email}</p>
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <button onClick={() => handleResolve(d.id, 'REFUND')} className="flex-1 px-3 py-2 text-sm font-medium bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors">환불</button>
              <button onClick={() => handleResolve(d.id, 'COMPLETE')} className="flex-1 px-3 py-2 text-sm font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors">정산 확정</button>
              <button onClick={() => handleResolve(d.id, 'CANCEL')} className="flex-1 px-3 py-2 text-sm font-medium bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors">거래 취소</button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── Orders Tab ───
function OrdersTab({ toast }: { toast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void }) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await analyticsService.getAdminOrders(statusFilter ? { status: statusFilter } : undefined);
      setOrders(data);
    } catch {
      toast('error', '주문 목록 로드 실패');
    } finally {
      setIsLoading(false);
    }
  }, [toast, statusFilter]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const handleCancel = async (orderId: string) => {
    if (!confirm('이 주문을 강제 취소하시겠습니까?')) return;
    try {
      await analyticsService.adminCancelOrder(orderId);
      toast('success', '주문이 취소되었습니다');
      loadOrders();
    } catch (err: any) {
      toast('error', err.response?.data?.message || '주문 취소 실패');
    }
  };

  return (
    <Card title={`전체 주문 (${orders.length}건)`}>
      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {['', 'PENDING', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'EXPIRED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              statusFilter === s
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {s ? (ORDER_STATUS[s]?.text || s) : '전체'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">로딩 중...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-3 font-medium">유형</th>
                <th className="pb-3 font-medium">에너지원</th>
                <th className="pb-3 font-medium text-right">수량 (kWh)</th>
                <th className="pb-3 font-medium text-right">가격</th>
                <th className="pb-3 font-medium">사용자</th>
                <th className="pb-3 font-medium">상태</th>
                <th className="pb-3 font-medium">일시</th>
                <th className="pb-3 font-medium text-right">작업</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const st = ORDER_STATUS[order.status];
                return (
                  <tr key={order.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-3">
                      <Badge variant={order.type === 'BUY' ? 'info' : 'warning'} size="sm">{order.type === 'BUY' ? '매수' : '매도'}</Badge>
                    </td>
                    <td className="py-3 text-gray-700">{SOURCE_LABELS[order.energySource] || order.energySource}</td>
                    <td className="py-3 text-right font-medium">{order.quantity.toLocaleString()}</td>
                    <td className="py-3 text-right">{order.price.toLocaleString()} {order.paymentCurrency}</td>
                    <td className="py-3 text-gray-600">{order.user.name}</td>
                    <td className="py-3">{st && <Badge variant={st.variant} size="sm">{st.text}</Badge>}</td>
                    <td className="py-3 text-gray-400 text-xs">{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 text-right">
                      {(order.status === 'PENDING' || order.status === 'PARTIALLY_FILLED') && (
                        <button onClick={() => handleCancel(order.id)} className="text-xs text-red-600 hover:text-red-700 font-medium">
                          취소
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ─── Helper Components ───
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
