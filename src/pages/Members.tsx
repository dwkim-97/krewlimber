import {Award, Coins, Layers, MapPin, Search, ShieldCheck, Users} from 'lucide-react';
import {useState} from 'react';
import {Avatar, EmptyState, ErrorNotice, Loading, PageHeading} from '@/components/ui';
import {InfoButton} from '@/components/InfoButton';
import {TitleBadgeView} from '@/components/TitleList';
import {useResource} from '@/hooks/useResource';
import {hasManagementAccess, ROLE_LABELS} from '@/consts/roles';
import type {Member} from '@/types';
import {levelLabel} from '@/consts/levels';
import {GRADES} from '@/consts';
import '@/styles/members.css';
export function Members() {
  const {data, loading, error, reload} = useResource<{members: Member[]}>('/members');
  const [query, setQuery] = useState('');
  const [grade, setGrade] = useState('all');
  const members =
    data?.members.filter(
      m =>
        (m.nickname.toLowerCase().includes(query.trim().toLowerCase()) || m.fullName?.includes(query.trim())) &&
        (grade === 'all' || m.grade === grade)
    ) ?? [];
  const leaders = members
    .filter(m => hasManagementAccess(m.role))
    .sort((a, b) => (a.role === 'admin' ? 0 : 1) - (b.role === 'admin' ? 0 : 1));
  const regulars = members.filter(m => !hasManagementAccess(m.role));
  return (
    <div className="page-shell members-page">
      <PageHeading title="멤버">
        <span className="count-pill">
          <Users size={16} />
          {data ? `${data.members.length}명` : '—'}
        </span>
      </PageHeading>
      <div className="toolbar">
        <label className="search-field">
          <Search size={17} aria-hidden="true" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="닉네임·한글 이름 검색"
            aria-label="닉네임 또는 한글 이름으로 회원 검색"
          />
        </label>
        <label className="filter-select">
          <select value={grade} onChange={e => setGrade(e.target.value)} aria-label="난이도 필터">
            <option value="all">모든 난이도</option>
            {GRADES.map(g => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="members-help">포인트는 현재 잔액이며, 레벨은 운영진이 지정합니다.</p>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorNotice message={error} retry={reload} />
      ) : members.length ? (
        <>
          {leaders.length > 0 && <MemberGroup title="운영진" members={leaders} leadership />}
          {regulars.length > 0 && <MemberGroup title="회원" members={regulars} />}
        </>
      ) : (
        <EmptyState title="검색 결과가 없어요" description="검색어나 난이도를 바꿔보세요.">
          <button
            className="button button-outline"
            onClick={() => {
              setQuery('');
              setGrade('all');
            }}
          >
            필터 초기화
          </button>
        </EmptyState>
      )}
    </div>
  );
}
function MemberGroup({title, members, leadership = false}: {title: string; members: Member[]; leadership?: boolean}) {
  return (
    <section className="member-group" aria-label={title}>
      <div className="member-group-heading">
        <h2>
          {leadership ? <ShieldCheck size={17} aria-hidden="true" /> : <Users size={17} aria-hidden="true" />}
          {title}
        </h2>
        <span>{members.length}명</span>
        {leadership && <p>관리자·운영진</p>}
      </div>
      <ul className="member-grid" aria-label={`${title} 목록`}>
        {members.map((m, i) => (
          <li className={`member-card ${leadership ? 'member-card-leader' : ''}`} key={m.id}>
            <div className="member-card-header">
              <Avatar name={m.nickname} index={i} />
              <div className="member-card-name">
                <h3 title={m.nickname}>{m.nickname}</h3>
                <span>{m.fullName || '이름 미등록'}</span>
              </div>
              {leadership && <span className="member-role">{ROLE_LABELS[m.role]}</span>}
            </div>
            <div className="member-card-context">
              <span className="member-grade">{m.grade}</span>
              {(m.gym || m.location) && (
                <span title={[m.gym, m.location].filter(Boolean).join(' · ')}>
                  <MapPin size={11} aria-hidden="true" />
                  {m.gym || m.location}
                </span>
              )}
            </div>
            <dl className="member-card-stats">
              <div>
                <dt>
                  <Coins size={11} aria-hidden="true" />
                  포인트
                </dt>
                <dd>{(m.points ?? 0).toLocaleString()} P</dd>
              </div>
              <div>
                <dt>
                  <Layers size={11} aria-hidden="true" />
                  레벨
                </dt>
                <dd>{levelLabel(m.level ?? 0)}</dd>
              </div>
            </dl>
            {(m.titles.length > 0 || m.featuredAchievement) && (
              <div className="member-card-achievements">
                {m.titles.slice(0, 1).map(t => (
                  <TitleBadgeView key={t.id} title={t} />
                ))}
                {m.titles.length > 1 && (
                  <InfoButton title="보유 타이틀">
                    <ul>
                      {m.titles.map(t => (
                        <li key={t.id}>{t.name}</li>
                      ))}
                    </ul>
                  </InfoButton>
                )}
                {m.featuredAchievement && (
                  <div className="member-card-featured">
                    <Award size={12} aria-hidden="true" />
                    <span title={m.featuredAchievement.name}>{m.featuredAchievement.name}</span>
                    <InfoButton title={m.featuredAchievement.name}>
                      <p className="info-condition">{m.featuredAchievement.description}</p>
                      <p>전체 분기의 누적 기록으로 달성하는 업적입니다.</p>
                    </InfoButton>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
