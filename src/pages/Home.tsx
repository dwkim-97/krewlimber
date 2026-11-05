import {ArrowUpRight, Award, Mountain, UserRound, Users} from 'lucide-react';
import {Link} from 'react-router-dom';
import {ClimbingArt} from '@/components/ClimbingArt';
import {HonorCard} from '@/components/HonorCard';
import {EmptyState, ErrorNotice, Loading, TextLink} from '@/components/ui';
import {useResource} from '@/hooks/useResource';
import {useSession} from '@/hooks/useSession';
import type {Honor, Member} from '@/types';

export function Home() {
  const {user} = useSession();
  const records = useResource<{honors: Honor[]}>('/honors');
  const members = useResource<{members: Member[]}>('/members');
  return (
    <div className="page-shell dashboard">
      <div className="dashboard-topline">
        <span className="eyebrow">
          <span />
          YOUR CREW BASECAMP
        </span>
        <span>
          {new Date().toLocaleDateString('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}
        </span>
      </div>
      <section className="dashboard-welcome">
        <div>
          <span className="pill">
            <Mountain size={14} />
            KREWLIMBER MEMBERS
          </span>
          <h1>
            {user?.nickname}님,
            <br />
            오늘도 <span>한 홀드 더.</span>
          </h1>
          <p>다시 만나 반가워요. 오늘의 도전도 함께해요.</p>
          <Link className="button button-dark" to="/me">
            내 클라이밍 프로필
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <ClimbingArt />
      </section>
      <nav className="dashboard-links" aria-label="크루 바로가기">
        <Link to="/members">
          <span className="dashboard-icon">
            <Users size={24} />
          </span>
          <div>
            <span>OUR CREW</span>
            <h2>크루 멤버</h2>
            <p>함께 오르는 사람들</p>
          </div>
          <ArrowUpRight size={22} />
        </Link>
        <Link to="/hall-of-fame">
          <span className="dashboard-icon">
            <Award size={24} />
          </span>
          <div>
            <span>HALL OF FAME</span>
            <h2>명예의 전당</h2>
            <p>우리의 도전과 성장</p>
          </div>
          <ArrowUpRight size={22} />
        </Link>
        <Link to="/me">
          <span className="dashboard-icon">
            <UserRound size={24} />
          </span>
          <div>
            <span>MY PROFILE</span>
            <h2>내 정보</h2>
            <p>나를 소개하는 공간</p>
          </div>
          <ArrowUpRight size={22} />
        </Link>
      </nav>
      <section className="dashboard-records">
        <div className="section-heading">
          <div>
            <div className="eyebrow">
              <span />
              LATEST MOMENTS
            </div>
            <h2>크루의 최근 기록</h2>
          </div>
          <TextLink to="/hall-of-fame">모든 기록 보기</TextLink>
        </div>
        {records.loading ? (
          <Loading />
        ) : records.error ? (
          <ErrorNotice message={records.error} retry={records.reload} />
        ) : records.data?.honors.length ? (
          <div className="honor-grid">
            {records.data.honors.slice(0, 3).map((honor, index) => (
              <HonorCard key={honor.id} honor={honor} index={index} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="크루의 첫 번째 기록을 기다려요"
            description="완등, 성장, 그리고 함께한 순간. 운영진이 등록한 기록을 이곳에서 확인할 수 있어요."
          />
        )}
      </section>
      <div className="dashboard-footnote">
        <Users size={16} />
        {members.error ? (
          <ErrorNotice message={members.error} retry={members.reload} />
        ) : members.data ? (
          <span>
            지금 <strong>{members.data.members.length}명</strong>의 크루가 함께하고 있어요.
          </span>
        ) : (
          <span>크루 소식을 불러오는 중이에요.</span>
        )}
        <Link to="/members">
          멤버 만나기
          <ArrowUpRight size={15} />
        </Link>
      </div>
    </div>
  );
}
