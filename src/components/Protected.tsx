import {LockKeyhole} from 'lucide-react';
import {Link, Navigate, useLocation} from 'react-router-dom';
import type {ReactNode} from 'react';
import {EmptyState, ErrorNotice, Loading} from '@/components/ui';
import {useSession} from '@/hooks/useSession';

export function Protected({children, access}: {children: ReactNode; access: 'user' | 'member' | 'admin'}) {
  const {user, loading, error} = useSession();
  const location = useLocation();
  if (loading) return <Loading />;
  if (error)
    return (
      <div className="page-shell">
        <ErrorNotice message={error} retry={() => window.location.reload()} />
      </div>
    );
  if (!user) return <Navigate to="/login" state={{from: location.pathname}} replace />;
  if (access !== 'user' && user.status !== 'approved')
    return (
      <div className="page-shell">
        <EmptyState
          title="크루 합류를 기다리고 있어요"
          description="운영진의 가입 승인 후 멤버 공간을 이용할 수 있습니다."
        >
          <Link className="button button-dark" to="/me">
            <LockKeyhole size={17} />내 가입 상태 확인
          </Link>
        </EmptyState>
      </div>
    );
  if (access === 'admin' && user.role !== 'admin')
    return (
      <div className="page-shell">
        <EmptyState
          title="운영진을 위한 공간이에요"
          description="회원 관리는 관리자 권한이 있는 계정만 이용할 수 있습니다."
        >
          <Link className="button button-dark" to="/">
            홈으로
          </Link>
        </EmptyState>
      </div>
    );
  return children;
}
