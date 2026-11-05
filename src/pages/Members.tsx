import {ArrowUpRight, MapPin, Mountain, Search, Users} from 'lucide-react';
import {useState} from 'react';
import {Link} from 'react-router-dom';
import {Avatar, EmptyState, ErrorNotice, Loading, PageHeading} from '@/components/ui';
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
      <PageHeading
        eyebrow="MEET YOUR CREW"
        title="함께 오르는 사람들"
        description="각자의 개성으로, 같은 즐거움으로. 우리의 크루를 만나보세요."
      >
        <span className="count-pill">
          <Users size={17} />
          {data ? `${data.members.length}명의 크루` : 'OUR CREW'}
        </span>
      </PageHeading>
      <div className="toolbar">
        <label className="search-field">
          <Search size={19} />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="어떤 크루를 찾고 있나요?"
            aria-label="닉네임으로 회원 검색"
          />
        </label>
        <label className="filter-select">
          <span>주요 난이도</span>
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
            <article className="member-card" key={member.id}>
              <div className="member-card-top">
                <Avatar name={member.nickname} index={index} />
                <span className="grade-tag">{member.grade}</span>
              </div>
              <h3>{member.nickname}</h3>
              <p className="member-bio">{member.bio || '아직 자기소개를 등록하지 않았어요.'}</p>
              <div className="member-meta">
                <span>
                  <MapPin size={14} />
                  {member.location || '활동 지역 미등록'}
                </span>
                <span>
                  <Mountain size={14} />
                  {member.gym || '주 활동 암장 미등록'}
                </span>
              </div>
              <div className="member-since">CREW SINCE {member.createdAt.slice(0, 7).replace('-', '.')}</div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title={query || grade !== 'all' ? '찾는 크루가 아직 보이지 않아요' : '크루의 첫 페이지를 채워주세요'}
          description={
            query || grade !== 'all'
              ? '검색어 또는 난이도를 바꿔 다시 찾아보세요.'
              : '프로필을 채우고 함께할 크루에게 나를 소개해보세요.'
          }
        >
          {query || grade !== 'all' ? (
            <button
              className="button button-outline"
              onClick={() => {
                setQuery('');
                setGrade('all');
              }}
            >
              필터 초기화
            </button>
          ) : (
            <Link className="button button-dark" to="/me">
              내 프로필 채우기
              <ArrowUpRight size={17} />
            </Link>
          )}
        </EmptyState>
      )}
    </div>
  );
}
