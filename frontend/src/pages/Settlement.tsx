export default function Settlement() {
  const mockSettlements = [
    {
      id: '1',
      tradeId: 'T-001',
      energySource: '태양광',
      quantity: 1000,
      price: 120,
      amount: 120000,
      fee: 2400,
      netAmount: 117600,
      status: 'COMPLETED',
      settledAt: '2025-03-15',
    },
    {
      id: '2',
      tradeId: 'T-002',
      energySource: '풍력',
      quantity: 500,
      price: 110,
      amount: 55000,
      fee: 1100,
      netAmount: 53900,
      status: 'PENDING',
      settledAt: null,
    },
    {
      id: '3',
      tradeId: 'T-003',
      energySource: '태양광',
      quantity: 2000,
      price: 125,
      amount: 250000,
      fee: 5000,
      netAmount: 245000,
      status: 'PROCESSING',
      settledAt: null,
    },
  ];

  const statusLabel: Record<string, { text: string; color: string }> = {
    PENDING: { text: '대기', color: 'bg-yellow-100 text-yellow-700' },
    PROCESSING: { text: '처리중', color: 'bg-blue-100 text-blue-700' },
    COMPLETED: { text: '완료', color: 'bg-green-100 text-green-700' },
    FAILED: { text: '실패', color: 'bg-red-100 text-red-700' },
  };

  const totalAmount = mockSettlements.reduce((s, d) => s + d.amount, 0);
  const totalFee = mockSettlements.reduce((s, d) => s + d.fee, 0);
  const totalNet = mockSettlements.reduce((s, d) => s + d.netAmount, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">정산</h1>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">총 정산 금액</p>
          <p className="text-2xl font-bold mt-1">
            {totalAmount.toLocaleString()} 원
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">총 수수료</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">
            {totalFee.toLocaleString()} 원
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">총 실수령액</p>
          <p className="text-2xl font-bold text-primary-600 mt-1">
            {totalNet.toLocaleString()} 원
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                거래 ID
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                에너지원
              </th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">
                수량 (kWh)
              </th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">
                금액 (원)
              </th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">
                수수료
              </th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">
                실수령액
              </th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">
                상태
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {mockSettlements.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-mono">{s.tradeId}</td>
                <td className="px-4 py-3 text-sm">{s.energySource}</td>
                <td className="px-4 py-3 text-sm text-right">
                  {s.quantity.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  {s.amount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-right text-orange-600">
                  {s.fee.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-right font-medium">
                  {s.netAmount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${statusLabel[s.status]?.color}`}
                  >
                    {statusLabel[s.status]?.text}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
