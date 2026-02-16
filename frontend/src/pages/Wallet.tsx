import { useEffect, useState } from 'react';
import { useTokenStore } from '../store/tokenStore';
import { tokenService } from '../services/token.service';

interface TokenTx {
  id: string;
  type: string;
  fromId: string | null;
  toId: string | null;
  amount: number;
  reason: string | null;
  createdAt: string;
}

const txTypeLabel: Record<string, { text: string; color: string }> = {
  MINT: { text: '발행', color: 'bg-green-100 text-green-700' },
  BURN: { text: '소각', color: 'bg-red-100 text-red-700' },
  TRANSFER: { text: '이체', color: 'bg-blue-100 text-blue-700' },
  LOCK: { text: '잠금', color: 'bg-yellow-100 text-yellow-700' },
  UNLOCK: { text: '해제', color: 'bg-purple-100 text-purple-700' },
};

export default function Wallet() {
  const { balance, lockedBalance, availableBalance, isLoading, fetchBalance } =
    useTokenStore();
  const [transactions, setTransactions] = useState<TokenTx[]>([]);
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferReason, setTransferReason] = useState('');

  useEffect(() => {
    fetchBalance();
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const data = await tokenService.getTransactions();
      setTransactions(data);
    } catch {
      // ignore
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
      fetchBalance();
      loadTransactions();
    } catch (err: any) {
      alert(err.response?.data?.message || '이체 실패');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">EPC 지갑</h1>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-primary-500 to-primary-700 text-white p-6 rounded-xl shadow-lg">
          <p className="text-sm opacity-80">총 EPC 잔액</p>
          <p className="text-3xl font-bold mt-1">
            {isLoading ? '...' : balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs opacity-70 mt-1">EPC (= kWh)</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">가용 잔액</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {availableBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} EPC
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">거래 잠금</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">
            {lockedBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} EPC
          </p>
        </div>
      </div>

      {/* Transfer Form */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">EPC 이체</h2>
        <form onSubmit={handleTransfer} className="flex gap-4 flex-wrap">
          <input
            type="text"
            placeholder="수신자 ID"
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
            required
          />
          <input
            type="number"
            placeholder="수량 (EPC)"
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm w-32"
            min="0.01"
            step="0.01"
            required
          />
          <input
            type="text"
            placeholder="사유 (선택)"
            value={transferReason}
            onChange={(e) => setTransferReason(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[150px]"
          />
          <button
            type="submit"
            className="bg-primary-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            이체
          </button>
        </form>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">거래 이력</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">유형</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">수량</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">사유</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">일시</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${txTypeLabel[tx.type]?.color || 'bg-gray-100'}`}
                  >
                    {txTypeLabel[tx.type]?.text || tx.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-right font-mono">
                  {tx.type === 'BURN' || tx.type === 'LOCK' ? '-' : '+'}
                  {tx.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{tx.reason || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(tx.createdAt).toLocaleString('ko-KR')}
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  거래 이력이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
