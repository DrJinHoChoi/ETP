import { useEffect, useState } from 'react';
import { useTokenStore } from '../store/tokenStore';
import { tokenService } from '../services/token.service';
import { Card, Badge, Button, StatCard } from '../components/ui';
import { useToast } from '../components/ui/Toast';

interface TokenTx {
  id: string;
  type: string;
  fromId: string | null;
  toId: string | null;
  amount: number;
  reason: string | null;
  createdAt: string;
}

const TX_TYPE_MAP: Record<string, { text: string; variant: 'success' | 'error' | 'info' | 'warning' | 'primary'; icon: string }> = {
  MINT: { text: '발행', variant: 'success', icon: '✨' },
  BURN: { text: '소각', variant: 'error', icon: '🔥' },
  TRANSFER: { text: '이체', variant: 'info', icon: '↔️' },
  LOCK: { text: '잠금', variant: 'warning', icon: '🔒' },
  UNLOCK: { text: '해제', variant: 'primary', icon: '🔓' },
};

export default function Wallet() {
  const { balance, lockedBalance, availableBalance, isLoading, fetchBalance } = useTokenStore();
  const [transactions, setTransactions] = useState<TokenTx[]>([]);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchBalance();
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const data = await tokenService.getTransactions();
      setTransactions(data);
    } catch {
      toast('error', '거래 내역 로드 실패');
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await tokenService.transfer({
        toUserId: transferTo,
        amount: parseFloat(transferAmount),
        reason: transferReason || undefined,
      });
      setTransferTo('');
      setTransferAmount('');
      setTransferReason('');
      setShowTransfer(false);
      toast('success', 'EPC 이체가 완료되었습니다');
      fetchBalance();
      loadTransactions();
    } catch (err: any) {
      toast('error', err.response?.data?.message || '이체 실패');
    }
  };

  const inputClass = "w-full px-3.5 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none";

  return (
    <div className="space-y-6 slide-up">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">EPC 지갑</h1>
          <p className="text-sm text-gray-500 mt-1">EPC 토큰 잔액과 거래 이력을 관리하세요</p>
        </div>
        <Button onClick={() => setShowTransfer(!showTransfer)} variant={showTransfer ? 'secondary' : 'primary'}>
          {showTransfer ? '닫기' : '💸 이체'}
        </Button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="총 EPC 잔액"
          value={isLoading ? '...' : `${balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} EPC`}
          subtitle="1 EPC = 1 kWh"
          variant="gradient-green"
          icon={<span className="text-lg">🪙</span>}
        />
        <StatCard
          title="가용 잔액"
          value={`${availableBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} EPC`}
          subtitle="이체/거래 가능"
          icon={<span className="text-lg">✅</span>}
        />
        <StatCard
          title="거래 잠금"
          value={`${lockedBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} EPC`}
          subtitle="진행 중인 거래"
          icon={<span className="text-lg">🔒</span>}
        />
      </div>

      {/* Balance Bar */}
      {balance > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">잔액 구성</span>
            <span className="text-xs text-gray-400">{((availableBalance / balance) * 100).toFixed(1)}% 가용</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div className="h-full flex">
              <div className="bg-green-500 transition-all" style={{ width: `${(availableBalance / balance) * 100}%` }} />
              <div className="bg-orange-400 transition-all" style={{ width: `${(lockedBalance / balance) * 100}%` }} />
            </div>
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full" /> 가용</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-orange-400 rounded-full" /> 잠금</span>
          </div>
        </Card>
      )}

      {/* Transfer Form */}
      {showTransfer && (
        <Card title="EPC 이체" className="animate-in">
          <form onSubmit={handleTransfer} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">수신자 ID</label>
              <input type="text" placeholder="사용자 UUID" value={transferTo} onChange={(e) => setTransferTo(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">수량 (EPC)</label>
              <input type="number" placeholder="0.00" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} className={inputClass} min="0.01" step="0.01" required />
              <p className="text-xs text-gray-400 mt-1">가용: {availableBalance.toLocaleString()} EPC</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">사유 (선택)</label>
              <input type="text" placeholder="이체 사유를 입력하세요" value={transferReason} onChange={(e) => setTransferReason(e.target.value)} className={inputClass} />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" size="lg">이체 실행</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Transaction History */}
      <Card title="거래 이력" subtitle={`총 ${transactions.length}건`} padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['유형', '수량', '사유', '일시'].map((h) => (
                  <th key={h} className={`px-4 py-3 font-semibold text-gray-600 ${h === '수량' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {transactions.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-16 text-center text-gray-400"><span className="text-3xl block mb-2">🪙</span>거래 이력이 없습니다</td></tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span>{TX_TYPE_MAP[tx.type]?.icon || '📝'}</span>
                        <Badge variant={TX_TYPE_MAP[tx.type]?.variant || 'neutral'}>
                          {TX_TYPE_MAP[tx.type]?.text || tx.type}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      <span className={tx.type === 'BURN' || tx.type === 'LOCK' ? 'text-red-600' : 'text-green-600'}>
                        {tx.type === 'BURN' || tx.type === 'LOCK' ? '-' : '+'}
                        {tx.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{tx.reason || '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(tx.createdAt).toLocaleString('ko-KR')}</td>
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
