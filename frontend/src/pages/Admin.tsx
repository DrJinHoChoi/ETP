export default function Admin() {
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
              <span>4 (DID, Trading, Settlement, Metering)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">상태</span>
              <span className="text-yellow-600">미설정</span>
            </div>
          </div>
        </div>

        {/* User Management */}
        <div className="bg-white p-6 rounded-xl shadow-sm border md:col-span-2">
          <h3 className="text-lg font-semibold mb-4">사용자 관리</h3>
          <p className="text-gray-500 text-sm">
            사용자 목록 및 관리 기능은 Phase 3에서 구현됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusItem({
  label,
  status,
}: {
  label: string;
  status: 'online' | 'offline';
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="flex items-center gap-2 text-sm">
        <span
          className={`w-2 h-2 rounded-full ${
            status === 'online' ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        {status === 'online' ? '정상' : '미연결'}
      </span>
    </div>
  );
}
