import { useEffect, useState } from 'react';
import { recTokenService } from '../services/rec-token.service';
import { Card, Badge, Button, StatCard } from '../components/ui';
import { useToast } from '../components/ui/Toast';
import Modal from '../components/ui/Modal';

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

const SOURCE_LABELS: Record<string, string> = { SOLAR: '태양광', WIND: '풍력', HYDRO: '수력', BIOMASS: '바이오매스', GEOTHERMAL: '지열' };
const SOURCE_ICONS: Record<string, string> = { SOLAR: '☀️', WIND: '🌬️', HYDRO: '💧', BIOMASS: '🌿', GEOTHERMAL: '🌋' };
const STATUS_MAP: Record<string, { text: string; variant: 'success' | 'info' | 'neutral' }> = {
  ACTIVE: { text: '활성', variant: 'success' },
  TRANSFERRED: { text: '양도됨', variant: 'info' },
  RETIRED: { text: '소멸', variant: 'neutral' },
};

export default function RECMarketplace() {
  const [tab, setTab] = useState<'marketplace' | 'my'>('marketplace');
  const [tokens, setTokens] = useState<RECToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [retireTarget, setRetireTarget] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => { loadTokens(); }, [tab]);

  const loadTokens = async () => {
    setIsLoading(true);
    try {
      const data = tab === 'marketplace'
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
    try {
      await recTokenService.retire(tokenId);
      toast('success', 'REC 토큰이 소멸 처리되었습니다. RE100 달성에 반영됩니다.');
      setRetireTarget(null);
      loadTokens();
    } catch (err: any) {
      toast('error', err.response?.data?.message || '소멸 실패');
    }
  };

  const totalCapacity = tokens.reduce((sum, t) => sum + t.quantity, 0);
  const activeTokens = tokens.filter((t) => t.status === 'ACTIVE').length;
  const sourceBreakdown = tokens.reduce((acc, t) => {
    acc[t.energySource] = (acc[t.energySource] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 slide-up">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">REC 마켓플레이스</h1>
          <p className="text-sm text-gray-500 mt-1">재생에너지 인증서(REC) 토큰을 관리하세요</p>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-1">
          {(['marketplace', 'my'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm rounded-lg transition-all ${tab === t ? 'bg-white shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}>
              {t === 'marketplace' ? '🏪 마켓플레이스' : '📦 내 REC 토큰'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title={tab === 'marketplace' ? '거래 가능 REC' : '보유 REC'}
          value={`${tokens.length}건`}
          subtitle={`활성 ${activeTokens}건`}
          variant="gradient-green"
          icon={<span className="text-lg">🌿</span>}
        />
        <StatCard
          title="총 용량"
          value={`${totalCapacity.toLocaleString()} kWh`}
          icon={<span className="text-lg">⚡</span>}
        />
        <Card>
          <p className="text-xs font-medium text-gray-500 mb-2">에너지원 구성</p>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(sourceBreakdown).map(([source, count]) => (
              <Badge key={source} variant="success">
                {SOURCE_ICONS[source]} {SOURCE_LABELS[source] || source}: {count}
              </Badge>
            ))}
            {Object.keys(sourceBreakdown).length === 0 && (
              <span className="text-sm text-gray-400">데이터 없음</span>
            )}
          </div>
        </Card>
      </div>

      {/* Token Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-16 text-center text-gray-400">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-200 border-t-primary-600" />
              로딩 중...
            </div>
          </div>
        ) : tokens.length === 0 ? (
          <div className="col-span-full py-16 text-center text-gray-400">
            <span className="text-4xl block mb-3">🌿</span>
            <p className="font-medium">{tab === 'marketplace' ? '거래 가능한 REC 토큰이 없습니다' : '보유한 REC 토큰이 없습니다'}</p>
          </div>
        ) : (
          tokens.map((token) => (
            <div key={token.id} className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-all hover:-translate-y-0.5">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded">{token.id.slice(0, 8)}...</span>
                <Badge variant={STATUS_MAP[token.status]?.variant || 'neutral'} dot>
                  {STATUS_MAP[token.status]?.text || token.status}
                </Badge>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-2xl">
                  {SOURCE_ICONS[token.energySource] || '⚡'}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{SOURCE_LABELS[token.energySource] || token.energySource}</p>
                  <p className="text-xs text-gray-500">빈티지: {token.vintage}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">용량</span>
                  <span className="font-bold text-gray-900">{token.quantity.toLocaleString()} kWh</span>
                </div>
                {token.issuer && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">발급자</span>
                    <span className="text-gray-700">{token.issuer.organization}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">유효기한</span>
                  <span className="text-gray-700">{new Date(token.validUntil).toLocaleDateString('ko-KR')}</span>
                </div>
                {token.location && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">위치</span>
                    <span className="text-gray-700">{token.location}</span>
                  </div>
                )}
              </div>

              {tab === 'my' && token.status === 'ACTIVE' && (
                <Button
                  variant="danger"
                  size="sm"
                  className="w-full mt-3"
                  onClick={() => setRetireTarget(token.id)}
                >
                  🌱 RE100 소멸 처리
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Retire Confirmation Modal */}
      <Modal
        open={!!retireTarget}
        onClose={() => setRetireTarget(null)}
        title="REC 토큰 소멸 확인"
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setRetireTarget(null)}>취소</Button>
            <Button variant="danger" onClick={() => retireTarget && handleRetire(retireTarget)}>소멸 처리</Button>
          </div>
        }
      >
        <p className="text-sm text-gray-600">
          이 REC 토큰을 소멸 처리하시겠습니까?<br />
          소멸된 토큰은 RE100 달성 실적에 반영되며, 이 작업은 되돌릴 수 없습니다.
        </p>
      </Modal>
    </div>
  );
}
