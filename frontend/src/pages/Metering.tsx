import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const mockData = Array.from({ length: 24 }, (_, i) => ({
  time: `${String(i).padStart(2, '0')}:00`,
  생산량: Math.round(
    i >= 6 && i <= 18
      ? Math.sin(((i - 6) * Math.PI) / 12) * 800 + Math.random() * 100
      : Math.random() * 50,
  ),
  소비량: Math.round(300 + Math.sin(((i - 8) * Math.PI) / 16) * 200 + Math.random() * 100),
}));

export default function Metering() {
  const totalProduction = mockData.reduce((s, d) => s + d.생산량, 0);
  const totalConsumption = mockData.reduce((s, d) => s + d.소비량, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">미터링</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">오늘 총 생산량</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {totalProduction.toLocaleString()} kWh
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">오늘 총 소비량</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {totalConsumption.toLocaleString()} kWh
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">순 에너지</p>
          <p
            className={`text-2xl font-bold mt-1 ${
              totalProduction - totalConsumption >= 0
                ? 'text-green-600'
                : 'text-red-600'
            }`}
          >
            {(totalProduction - totalConsumption).toLocaleString()} kWh
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <h3 className="text-lg font-semibold mb-4">시간대별 생산/소비량</h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={mockData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="생산량"
              stroke="#22c55e"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="소비량"
              stroke="#3b82f6"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Readings Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">최근 미터링 데이터</h3>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                시간
              </th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">
                생산량 (kWh)
              </th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">
                소비량 (kWh)
              </th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">
                순 에너지 (kWh)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {mockData
              .slice(-10)
              .reverse()
              .map((d, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{d.time}</td>
                  <td className="px-4 py-3 text-sm text-right text-green-600">
                    {d.생산량.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-blue-600">
                    {d.소비량.toLocaleString()}
                  </td>
                  <td
                    className={`px-4 py-3 text-sm text-right ${
                      d.생산량 - d.소비량 >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {(d.생산량 - d.소비량).toLocaleString()}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
