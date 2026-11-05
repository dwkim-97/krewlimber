import {Award, Flag, Sparkles} from 'lucide-react';
import {useState} from 'react';
import {HonorCard} from '@/components/HonorCard';
import {EmptyState, ErrorNotice, Loading, PageHeading} from '@/components/ui';
import {useResource} from '@/hooks/useResource';
import type {Honor, HonorKind} from '@/types';
import {HONOR_LABELS} from '@/consts';

export function HallOfFame() {
  const {data, loading, error, reload} = useResource<{honors: Honor[]}>('/honors');
  const [kind, setKind] = useState<HonorKind | 'all'>('all');
  const honors = data?.honors.filter(honor => kind === 'all' || honor.kind === kind) ?? [];
  return (
    <div className="page-shell">
      <PageHeading
        eyebrow="HALL OF FAME"
        title="기억하고 싶은 모든 도전"
        description="첫 완등도, 꾸준한 성장도, 함께한 마음도. 크루의 빛나는 순간들입니다."
      >
        <span className="heading-emblem">
          <Award size={44} strokeWidth={1.2} />
        </span>
      </PageHeading>
      <div className="hall-banner">
        <Flag size={24} />
        <p>
          정상에 닿은 순간만큼,
          <br className="mobile-only" /> 그곳까지의 모든 도전을 응원해요.
        </p>
        <Sparkles size={26} />
      </div>
      <div className="tabs" aria-label="기록 종류">
        <button className={kind === 'all' ? 'active' : ''} onClick={() => setKind('all')}>
          모든 순간
        </button>
        {(Object.keys(HONOR_LABELS) as HonorKind[]).map(value => (
          <button key={value} className={kind === value ? 'active' : ''} onClick={() => setKind(value)}>
            {HONOR_LABELS[value]}
          </button>
        ))}
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorNotice message={error} retry={reload} />
      ) : honors.length ? (
        <div className="honor-grid">
          {honors.map((honor, index) => (
            <HonorCard key={honor.id} honor={honor} index={index} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="첫 번째 멋진 순간을 기다려요"
          description="회원의 성과는 운영진이 확인해 등록합니다. 함께 축하할 기록을 차곡차곡 쌓아갈게요."
        >
          <span className="empty-caption">
            <Sparkles size={15} />
            누구나 이곳의 주인공이 될 수 있어요.
          </span>
        </EmptyState>
      )}
    </div>
  );
}
