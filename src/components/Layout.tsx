import {ArrowUpRight, Menu, X} from 'lucide-react';
import {useEffect, useState} from 'react';
import {Link, NavLink, Outlet, useLocation} from 'react-router-dom';
import {BrandLogo} from '@/components/BrandLogo';
import {useSession} from '@/hooks/useSession';

export function Layout() {
  const {user} = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const {pathname} = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
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
                  베이스캠프
                </NavLink>
                <NavLink to="/climbs">클라이밍 기록</NavLink>
                <NavLink to="/notices">공지사항</NavLink>
                <NavLink to="/market">포인트 마켓</NavLink>
                <NavLink to="/members">멤버</NavLink>
                <NavLink to="/hall-of-fame">명예의 전당</NavLink>
                {user.role === 'admin' && <NavLink to="/admin">크루 관리</NavLink>}
                <span className="nav-divider" />
              </>
            )}
            {user ? (
              <NavLink className="nav-account" to="/me">
                <span className="mini-avatar">{user.nickname.slice(0, 1)}</span>내 정보
              </NavLink>
            ) : (
              <>
                <NavLink to="/login">로그인</NavLink>
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
