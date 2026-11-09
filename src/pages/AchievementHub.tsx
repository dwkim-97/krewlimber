import {Award, Settings2, Trophy} from 'lucide-react';
import {Link, useSearchParams} from 'react-router-dom';
import {Achievements} from '@/components/Achievements';
import {PageHeading} from '@/components/ui';
import {useSession} from '@/hooks/useSession';
import {hasManagementAccess} from '@/consts/roles';
import {HallOfFame} from '@/pages/HallOfFame';
export function AchievementHub() {
  const [params, setParams] = useSearchParams();
  const hall = params.get('tab') === 'hall';
  const {user} = useSession();
  return (
    <div className="page-shell achievement-hub">
      <PageHeading title="업적">
        {hasManagementAccess(user?.role) && (
          <Link className="button button-outline button-small" to="/admin?tab=achievements">
            <Settings2 size={14} />
            업적 관리
          </Link>
        )}
      </PageHeading>
      <div className="tabs achievement-hub-tabs" aria-label="업적 메뉴">
        <button className={!hall ? 'active' : ''} aria-pressed={!hall} onClick={() => setParams({tab: 'list'})}>
          <Award size={16} />
          업적 목록
        </button>
        <button className={hall ? 'active' : ''} aria-pressed={hall} onClick={() => setParams({tab: 'hall'})}>
          <Trophy size={16} />
          명예의 전당
        </button>
      </div>
      <p className="achievement-hub-description">
        {hall
          ? '분기별 활동 기록으로 선정하는 타이틀과 순위예요. 동점자는 함께 표시됩니다.'
          : '누적 기록으로 조건을 달성하는 업적이에요. 모든 업적과 내 달성 현황을 확인하고 대표 업적을 선택할 수 있어요.'}
      </p>
      {hall ? <HallOfFame embedded /> : <Achievements />}
    </div>
  );
}
