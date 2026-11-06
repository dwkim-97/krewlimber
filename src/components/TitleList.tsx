import {
  ChevronDown,
  Coins,
  Crown,
  Flame,
  Mountain,
  ShoppingBag,
  Sparkles,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {useState} from 'react';
import {InfoButton} from '@/components/InfoButton';
import type {ProgressMetric, TitleBadge, TitleCategory} from '@/types';
import {quarterLabel} from '@/consts/progression';

const titleIcons: Record<ProgressMetric, LucideIcon> = {
  participation: Mountain,
  hosted: Zap,
  attended: Users,
  red: Flame,
  pink: Flame,
  purple: Flame,
  gray: Flame,
  pointsEarned: Coins,
  pointsSpent: ShoppingBag,
};
function TitleConditions({id, description, quarter}: {id: string; description: string; quarter: string | null}) {
  return (
    <>
      <p className="info-condition">{description}</p>
      <p>
        {quarter ? quarterLabel(quarter) : '해당 분기'}의 승인된 회원 기록을 비교해 선정합니다. 0인 기록은 제외하며,
        동률이면 공동으로 칭호를 받습니다.
      </p>
      {id === 'pointsEarned' && (
        <p>분기 내 지급 포인트에서 차감 정정을 뺀 값입니다. 환불은 획득에 포함하지 않습니다.</p>
      )}
      {id === 'pointsSpent' && <p>분기 내 신청한 교환의 포인트 합계입니다. 취소된 교환과 환불은 제외합니다.</p>}
    </>
  );
}

export function TitleBadgeView({title}: {title: TitleBadge}) {
  return (
    <span className={`title-badge accent-${title.accent}`}>
      <Crown size={17} />
      <span>{title.name}</span>
      <Sparkles className="title-badge-spark" size={12} />
      <InfoButton title={title.name}>
        <TitleConditions id={title.id} description={title.description} quarter={title.quarter} />
      </InfoButton>
    </span>
  );
}

export function TitleList({categories}: {categories: TitleCategory[]}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="title-list">
      {categories.map(category => {
        const leaders = category.standings.filter(person => person.rank === 1);
        const Icon = titleIcons[category.metric];
        const open = expanded === category.id;
        return (
          <article className={`title-tile accent-${category.accent}`} key={category.id}>
            <div className="title-tile-header">
              <button
                className="title-toggle"
                aria-expanded={open}
                aria-controls={`ranking-${category.id}`}
                onClick={() => setExpanded(open ? null : category.id)}
              >
                <span className="title-symbol">
                  <Icon size={25} strokeWidth={1.6} />
                  <Crown className="title-symbol-crown" size={13} />
                </span>
                <span className="title-name">{category.name}</span>
                <span className="title-holders">
                  <strong>
                    {leaders.length ? leaders.map(person => person.nickname).join(', ') : '아직 보유자가 없어요'}
                  </strong>
                  <small>
                    {category.description}
                    {leaders.length ? ` · ${leaders[0].value.toLocaleString('ko-KR')}${category.unit}` : ''}
                  </small>
                </span>
                <ChevronDown size={17} className={open ? 'chevron-open' : ''} />
              </button>
              <InfoButton title={category.name}>
                <TitleConditions id={category.id} description={category.description} quarter={null} />
              </InfoButton>
            </div>
            {open && (
              <div className="title-ranking" id={`ranking-${category.id}`}>
                {category.standings.length ? (
                  <ol aria-label={`${category.name} 순위`}>
                    {category.standings.slice(0, 5).map(person => (
                      <li key={person.userId}>
                        <span className={person.rank === 1 ? 'rank-first' : ''}>
                          {person.rank === 1 ? <Crown size={15} /> : person.rank}
                        </span>
                        <strong>{person.nickname}</strong>
                        <span>
                          {person.value.toLocaleString('ko-KR')}
                          {category.unit}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>등록된 기록이 없습니다.</p>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
