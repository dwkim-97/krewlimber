import {ArrowUpRight, Award, Mountain, UserRound, Users} from 'lucide-react';
import {Link} from 'react-router-dom';
import {GuideHighlights} from '@/pages/Guide';
import {TitleList} from '@/components/TitleList';
import {ErrorNotice, Loading, TextLink} from '@/components/ui';
import {useResource} from '@/hooks/useResource';
import {useSession} from '@/hooks/useSession';
import type {TitleBoard} from '@/types';
import {quarterLabel} from '@/consts/progression';

export function Home() {
  const {user} = useSession();
  const titles = useResource<TitleBoard>('/titles');
  return (
    <div className="page-shell dashboard">
      <section className="dashboard-welcome">
        <div>
          <span className="pill">
            <Mountain size={14} />
            크루라이머
          </span>
          <h1>
            {user?.nickname}님,
            <br />
            오늘도 <span>한 홀드 더.</span>
          </h1>
          <Link className="button button-dark" to="/me">
            내 정보
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <img
          className="dashboard-mascot"
          src="/chun-sik-02.webp"
          alt="초크백을 준비하는 춘식이"
          width={1080}
          height={1080}
        />
      </section>
      <GuideHighlights />
      <nav className="dashboard-links" aria-label="크루 바로가기">
        <Link to="/me?tab=climbing">
          <span className="dashboard-icon">
            <Mountain size={24} />
          </span>
          <h2>등반 기록</h2>
          <ArrowUpRight size={22} />
        </Link>
        <Link to="/members">
          <span className="dashboard-icon">
            <Users size={24} />
          </span>
          <h2>멤버</h2>
          <ArrowUpRight size={22} />
        </Link>
        <Link to="/achievements?tab=hall">
          <span className="dashboard-icon">
            <Award size={24} />
          </span>
          <h2>명예의 전당</h2>
          <ArrowUpRight size={22} />
        </Link>
        <Link to="/me?tab=achievements">
          <span className="dashboard-icon">
            <UserRound size={24} />
          </span>
          <h2>내 업적</h2>
          <ArrowUpRight size={22} />
        </Link>
      </nav>
      <section className="dashboard-records">
        <div className="section-heading">
          <h2>{titles.data ? quarterLabel(titles.data.quarter) : '이번 분기'} 타이틀</h2>
          <TextLink to="/achievements?tab=hall">전체 보기</TextLink>
        </div>
        {titles.loading ? (
          <Loading />
        ) : titles.error ? (
          <ErrorNotice message={titles.error} retry={titles.reload} />
        ) : (
          titles.data && <TitleList categories={titles.data.categories.slice(0, 3)} />
        )}
      </section>
    </div>
  );
}
