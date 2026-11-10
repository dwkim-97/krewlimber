import {hasManagementAccess} from '@/consts/roles';
import {
  ArrowUpRight,
  Menu,
  X,
  Mountain,
  Megaphone,
  BookOpen,
  MapPinned,
  Trophy,
  Users,
  ShieldCheck,
  UserRound,
  LogIn,
  Grid3X3,
} from 'lucide-react';
import {useEffect, useState} from 'react';
import {Link, NavLink, Outlet, useLocation} from 'react-router-dom';
import {BrandLogo} from '@/components/BrandLogo';
import {useSession} from '@/hooks/useSession';

export function Layout() {
  const {user} = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const {pathname, hash} = useLocation();
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);
  return (
    <>
      <a className="skip-link" href="#main">
        본문으로 이동
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="brand-link" aria-label="크루라이머 홈" onClick={() => setMenuOpen(false)}>
            <BrandLogo />
          </Link>
          <button
            className="menu-toggle"
            aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
            aria-expanded={menuOpen}
            aria-controls="main-nav"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
          <nav
            id="main-nav"
            className={menuOpen ? 'nav open' : 'nav'}
            aria-label="메인 메뉴"
            onClick={() => setMenuOpen(false)}
          >
            {user?.status === 'approved' && (
              <>
                <NavLink to="/" end>
                  <Mountain size={14} aria-hidden="true" /> 베이스캠프
                </NavLink>
                <NavLink to="/notices">
                  <Megaphone size={14} aria-hidden="true" /> 공지사항
                </NavLink>
                <NavLink to="/guide">
                  <BookOpen size={14} aria-hidden="true" /> 이용 안내
                </NavLink>
                <span className="nav-group-divider" aria-hidden="true" />
                <NavLink to="/gyms">
                  <MapPinned size={14} aria-hidden="true" /> 암장지도
                </NavLink>
                <NavLink to="/achievements">
                  <Trophy size={14} aria-hidden="true" /> 업적
                </NavLink>
                <span className="nav-group-divider" aria-hidden="true" />
                <NavLink to="/members">
                  <Users size={14} aria-hidden="true" /> 멤버
                </NavLink>
                {hasManagementAccess(user.role) && (
                  <NavLink to="/admin">
                    <ShieldCheck size={14} aria-hidden="true" /> 관리
                  </NavLink>
                )}
                <span className="nav-divider" aria-hidden="true" />
              </>
            )}
            <NavLink to="/event/bingo">
              <Grid3X3 size={14} aria-hidden="true" /> 이벤트 빙고
            </NavLink>
            {user ? (
              <NavLink className="nav-account" to="/me">
                <UserRound size={15} aria-hidden="true" /> 내 정보
              </NavLink>
            ) : (
              <>
                <NavLink to="/login">
                  <LogIn size={14} aria-hidden="true" /> 로그인
                </NavLink>
                <Link className="button button-dark button-small" to="/signup">
                  회원 가입
                  <ArrowUpRight size={16} />
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <footer className="site-footer compact-footer">
        <span>KREWLIMBER</span>
        <span>© {new Date().getFullYear()}</span>
      </footer>
    </>
  );
}
