import {Award, MapPin, Mountain, Search, Users} from 'lucide-react';
import {useState} from 'react';
import {Avatar, EmptyState, ErrorNotice, Loading, PageHeading} from '@/components/ui';
import {TitleBadgeView} from '@/components/TitleList';
import {useResource} from '@/hooks/useResource';
import type {Member} from '@/types';
import {GRADES} from '@/consts';

export function Members() {
  const {data, loading, error, reload} = useResource<{members: Member[]}>('/members');
  const [query, setQuery] = useState('');
  const [grade, setGrade] = useState('all');
  const members =
    data?.members.filter(
      member =>
        member.nickname.toLowerCase().includes(query.trim().toLowerCase()) &&
        (grade === 'all' || member.grade === grade)
    ) ?? [];
  return (
    <div className="page-shell">
      <PageHeading title="멤버">
        <span className="count-pill">
          <Users size={17} />
          {data ? `${data.members.length}명` : '—'}
        </span>
      </PageHeading>
      <div className="toolbar">
        <label className="search-field">
          <Search size={19} />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="닉네임 검색"
            aria-label="닉네임으로 회원 검색"
          />
        </label>
        <label className="filter-select">
          <select value={grade} onChange={event => setGrade(event.target.value)} aria-label="난이도 필터">
            <option value="all">모든 난이도</option>
            {GRADES.map(value => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorNotice message={error} retry={reload} />
      ) : members.length ? (
        <div className="members-grid">
          {members.map((member, index) => (
            <article className="member-card member-card-decorated" key={member.id}>
              <div className="member-card-top">
                <Avatar name={member.nickname} index={index} />
                <span className="grade-tag">{member.grade}</span>
              </div>
              <div className="member-name">
                <h3>{member.nickname}</h3>
                {member.titles.map(title => (
                  <TitleBadgeView key={title.id} title={title} />
                ))}
              </div>
              {member.featuredAchievement ? (
                <div className="member-featured" title={member.featuredAchievement.description}>
                  <Award size={20} />
                  <strong>{member.featuredAchievement.name}</strong>
                </div>
              ) : (
                <div className="member-featured member-featured-empty">
                  <Award size={18} />
                  <span>선택한 대표 업적 없음</span>
                </div>
              )}
              {member.bio && <p className="member-bio">{member.bio}</p>}
              <div className="member-meta">
                {member.location && (
                  <span>
                    <MapPin size={14} />
                    {member.location}
                  </span>
                )}
                {member.gym && (
                  <span>
                    <Mountain size={14} />
                    {member.gym}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
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
