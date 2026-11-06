import {Award, Camera, MapPin, Mountain, Search, Users} from 'lucide-react';
import {useState} from 'react';
import {Avatar, EmptyState, ErrorNotice, Loading, PageHeading} from '@/components/ui';
import {InfoButton} from '@/components/InfoButton';
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
        <ul className="members-list" aria-label="멤버 목록" role="list">
          {members.map((member, index) => (
            <li className="member-row" key={member.id}>
              <div className="member-row-profile">
                <Avatar name={member.nickname} index={index} />
                <div className="member-row-copy">
                  <div className="member-row-heading">
                    <h3>{member.nickname}</h3>
                    <span className="grade-tag">{member.grade}</span>
                  </div>
                  {member.instagramUrl && (
                    <a
                      className="member-instagram"
                      href={member.instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${member.nickname} 인스타그램`}
                    >
                      <Camera size={14} /> @{member.instagramUrl.split('/').filter(Boolean).at(-1)}
                    </a>
                  )}
                  {member.bio && <p className="member-bio">{member.bio}</p>}
                  {(member.location || member.gym) && (
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
                  )}
                </div>
              </div>
              <div className="member-row-badges">
                {member.titles.map(title => (
                  <TitleBadgeView key={title.id} title={title} />
                ))}
                {member.featuredAchievement ? (
                  <div className="member-featured">
                    <Award size={20} />
                    <strong>{member.featuredAchievement.name}</strong>
                    <InfoButton title={member.featuredAchievement.name}>
                      <p className="info-condition">{member.featuredAchievement.description}</p>
                      <p>전체 분기의 누적 기록으로 달성하는 업적입니다.</p>
                    </InfoButton>
                  </div>
                ) : (
                  <div className="member-featured member-featured-empty">
                    <Award size={18} />
                    <span>선택한 대표 업적 없음</span>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
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
