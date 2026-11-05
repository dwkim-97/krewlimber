import {ChevronDown, Crown, Flame, Mountain, Zap} from 'lucide-react';
import {useState} from 'react';
import type {TitleBadge, TitleCategory} from '@/types';
import {quarterLabel} from '@/consts/progression';

export function TitleBadgeView({title}: {title: TitleBadge}) {
  return (
    <span className={`title-badge accent-${title.accent}`} title={`${quarterLabel(title.quarter)} · ${title.name}`}>
      <Crown size={13} />
      {title.name}
    </span>
  );
}

export function TitleList({categories}: {categories: TitleCategory[]}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="title-list">
      {categories.map(category => {
        const leaders = category.standings.filter(person => person.rank === 1);
        const Icon = category.id === 'hosted' ? Zap : category.id === 'participation' ? Mountain : Flame;
        const open = expanded === category.id;
        return (
          <article className={`title-tile accent-${category.accent}`} key={category.id}>
            <button
              className="title-toggle"
              aria-expanded={open}
              aria-controls={`ranking-${category.id}`}
              onClick={() => setExpanded(open ? null : category.id)}
            >
              <span className="title-symbol">
                <Icon size={25} strokeWidth={1.6} />
              </span>
              <span className="title-name">{category.name}</span>
              <span className="title-holders">
                <strong>
                  {leaders.length ? leaders.map(person => person.nickname).join(', ') : '아직 보유자가 없어요'}
                </strong>
                <small>
                  {category.description}
                  {leaders.length ? ` · ${leaders[0].value}${category.unit}` : ''}
                </small>
              </span>
              <ChevronDown size={17} className={open ? 'chevron-open' : ''} />
            </button>
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
                          {person.value}
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
