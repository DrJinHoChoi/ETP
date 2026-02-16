import { useEffect, useState } from 'react';
import { recTokenService } from '../services/rec-token.service';

interface RECToken {
  id: string;
  certId: string | null;
  energySource: string;
  quantity: number;
  vintage: string;
  location: string | null;
  status: string;
  issuedAt: string;
  validUntil: string;
  retiredAt: string | null;
  issuer?: { name: string; organization: string };
  owner?: { name: string; organization: string };
}

const sourceLabel: Record<string, string> = {
  SOLAR: '태양광',
  WIND: '풍력',
  HYDRO: '수력',
  BIOMASS: '바이오매스',
  GEOTHERMAL: '지열',
};

const statusLabel: Record<string, { text: string; color: string }> = {
  ACTIVE: { text: '활성', color: 'bg-green-100 text-green-700' },
  TRANSFERRED: { text: '양도됨', color: 'bg-blue-100 text-blue-700' },
  RETIRED: { text: '소멸', color: 'bg-gray-100 text-gray-500' },
};

export default function RECMarketplace() {
  const [tab, setTab] = useState<'marketplace' | 'my'>('marketplace');
  const [tokens, setTokens] = useState<RECToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTokens();
  }, [tab]);

  const loadTokens = async () => {
    setIsLoading(true);
    try {
      const data =
        tab === 'marketplace'
          ? await recTokenService.getMarketplace()
          : await recTokenService.getMyTokens();
      setTokens(data);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetire = async (tokenId: string) => {
    if (!confirm('이 REC 토큰을 소멸 처리하시겠습니까? RE100 달성에 반영됩니다.')) return;
    try {
      await recTokenService.retire(tokenId);
      loadTokens();
    } catch (err: any) {
      alert(err.response?.data?.message || '소멸 실패');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">REC 마켓플레이스</h1>
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setTab('marketplace')}
            className={`px-4 py-2 text-sm rounded-md ${
              tab === 'marketplace'
                ? 'bg-white shadow-sm font-medium'
                : 'text-gray-500'
            }`}
          >
            마켓플레이스
          </button>
          <button
            onClick={() => setTab('my')}
            className={`px-4 py-2 text-sm rounded-md ${
              tab === 'my'
                ? 'bg-white shadow-sm font-medium'
                : 'text-gray-500'
            }`}
          >
            내 REC 토큰
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">
            {tab === 'marketplace' ? '거래 가능 REC' : '보유 REC'}
          </p>
          <p className="text-2xl font-bold mt-1">{tokens.length}건</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">총 용량</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {tokens
              .reduce((sum, t) => sum + t.quantity, 0)
              .toLocaleString()}{' '}
            kWh
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <p className="text-sm text-gray-500">에너지원 구성</p>
          <div className="flex gap-2 mt-2 flex-wrap">
            {Object.entries(
              tokens.reduce(
                (acc, t) => {
                  acc[t.energySource] = (acc[t.energySource] || 0) + 1;
                  return acc;
                },
                {} as Record<string, number>,
              ),
            ).map(([source, count]) => (
              <span
                key={source}
                className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded"
              >
                {sourceLabel[source] || source}: {count}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Token Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-12 text-gray-400">
            로딩 중...
          </div>
        ) : tokens.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400">
            {tab === 'marketplace'
              ? '거래 가능한 REC 토큰이 없습니다'
              : '보유한 REC 토큰이 없습니다'}
          </div>
        ) : (
          tokens.map((token) => (
            <div
              key={token.id}
              className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-mono text-gray-400">
                  {token.id.slice(0, 8)}...
                </span>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    statusLabel[token.status]?.color || 'bg-gray-100'
                  }`}
                >
                  {statusLabel[token.status]?.text || token.status}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">
                    {token.energySource === 'SOLAR'
                      ? '☀️'
                      : token.energySource === 'WIND'
                        ? '🌬️'
                        : '⚡'}
                  </span>
                  <div>
                    <p className="font-semibold">
                      {sourceLabel[token.energySource] || token.energySource}
                    </p>
                    <p className="text-xs text-gray-500">
                      빈티지: {token.vintage}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">용량</span>
                    <span className="text-sm font-bold">
                      {token.quantity.toLocaleString()} kWh
                    </span>
                  </div>
                  {token.issuer && (
                    <div className="flex justify-between mt-1">
                      <span className="text-sm text-gray-500">발급자</span>
                      <span className="text-sm">
                        {token.issuer.organization}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between mt-1">
                    <span className="text-sm text-gray-500">유효기한</span>
                    <span className="text-sm">
                      {new Date(token.validUntil).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                </div>
              </div>

              {tab === 'my' && token.status === 'ACTIVE' && (
                <button
                  onClick={() => handleRetire(token.id)}
                  className="mt-3 w-full py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                >
                  RE100 소멸 처리
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
