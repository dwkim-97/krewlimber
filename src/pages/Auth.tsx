import {ArrowUpRight, Check, KeyRound, Mountain} from 'lucide-react';
import {useState, type FormEvent} from 'react';
import {Link, Navigate, useLocation, useNavigate} from 'react-router-dom';
import {ErrorNotice, Loading} from '@/components/ui';
import {useSession} from '@/hooks/useSession';
import {api} from '@/apis/client';

export function Auth({mode}: {mode: 'login' | 'signup' | 'recover'}) {
  const {user, loading, refresh} = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const signup = mode === 'signup';
  const recovery = mode === 'recover';
  if (loading) return <Loading />;
  if (user && !recovery) return <Navigate to="/me" replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));
    if (mode !== 'login' && password !== form.get('confirm')) return setError('비밀번호가 일치하지 않습니다.');
    setBusy(true);
    setError('');
    try {
      const payload = recovery
        ? {username: form.get('username'), token: form.get('token'), newPassword: password}
        : {username: form.get('username'), password, ...(signup ? {nickname: form.get('nickname')} : {})};
      await api(`/auth/${recovery ? 'recover' : mode}`, {method: 'POST', body: JSON.stringify(payload)});
      await refresh();
      if (recovery) setDone(true);
      else {
        const from = (location.state as {from: string} | null)?.from;
        navigate(signup ? '/me' : from?.startsWith('/') ? from : '/me', {replace: true});
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <Mountain size={34} strokeWidth={1.4} />
        <div>
          <div className="eyebrow">KREWLIMBER / MEMBERS ONLY</div>
          <h2>
            오늘도,
            <br />한 홀드 더.<span>↗</span>
          </h2>
          <p>
            크루라이머 사내 클라이밍 동호회 <br />
            승인된 회원을 위한 공간입니다.
          </p>
        </div>
        <span className="auth-aside-bottom">PRIVATE CREW SPACE</span>
      </aside>
      <section className="auth-form-wrap">
        <div className="eyebrow">
          <span />
          {recovery ? 'A FRESH START' : signup ? 'JOIN OUR CREW' : 'NICE TO SEE YOU AGAIN'}
        </div>
        <h1>{recovery ? '비밀번호 다시 설정' : signup ? '크루 회원 가입' : '크루라이머 로그인'}</h1>
        <p className="auth-description">
          {recovery
            ? '운영진에게 신원 확인 후 받은 복구 코드를 입력해주세요.'
            : signup
              ? '나만의 아이디로 신청하면, 운영진이 확인해드려요.'
              : '아이디와 비밀번호로 크루 공간에 들어오세요.'}
        </p>
        {done ? (
          <div className="success-panel">
            <Check size={32} />
            <h3>비밀번호가 변경되었어요</h3>
            <p>새 비밀번호로 다시 로그인해주세요.</p>
            <Link className="button button-dark" to="/login">
              로그인하기
              <ArrowUpRight size={18} />
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} key={mode}>
            <label>
              아이디
              <input
                name="username"
                placeholder="aiden.dw"
                autoComplete="username"
                required
                minLength={3}
                maxLength={32}
                pattern="[A-Za-z][A-Za-z0-9._\-]{2,31}"
                autoCapitalize="none"
                spellCheck={false}
              />
              <small>영문으로 시작하는 3~32자의 영문, 숫자, . _ -</small>
            </label>
            {signup && (
              <label>
                크루에서 부를 이름
                <input
                  name="nickname"
                  placeholder="닉네임을 알려주세요"
                  autoComplete="nickname"
                  required
                  minLength={2}
                  maxLength={20}
                />
              </label>
            )}
            {recovery && (
              <label>
                운영진이 전달한 복구 코드
                <input
                  name="token"
                  autoComplete="off"
                  required
                  maxLength={128}
                  placeholder="30분 동안 유효한 일회용 코드"
                />
              </label>
            )}
            <label>
              {recovery ? '새 비밀번호' : '비밀번호'}
              <input
                name="password"
                type="password"
                placeholder={mode === 'login' ? '비밀번호를 입력해주세요' : '12자 이상의 비밀번호'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={mode === 'login' ? 1 : 12}
                maxLength={128}
              />
            </label>
            {mode !== 'login' && (
              <label>
                비밀번호 확인
                <input
                  name="confirm"
                  type="password"
                  placeholder="한 번 더 입력해주세요"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                />
              </label>
            )}
            {signup && (
              <div className="form-note">
                <Check size={17} />
                <span>가입 후 운영진 승인을 거쳐 회원 기능을 이용할 수 있어요.</span>
              </div>
            )}
            {typeof (location.state as {notice: unknown} | null)?.notice === 'string' && (
              <div className="notice success" role="status">
                {(location.state as {notice: string}).notice}
              </div>
            )}
            {error && <ErrorNotice message={error} retry={null} />}
            <button className="button button-dark button-full" disabled={busy}>
              {busy ? '처리 중…' : recovery ? '새 비밀번호 설정' : signup ? '크루 가입 신청' : '로그인'}
              <ArrowUpRight size={18} />
            </button>
            <div className="auth-switch">
              {signup ? (
                <>
                  이미 크루 멤버인가요? <Link to="/login">로그인</Link>
                </>
              ) : recovery ? (
                <Link to="/login">로그인으로 돌아가기</Link>
              ) : (
                <>
                  아직 크루 멤버가 아닌가요? <Link to="/signup">가입 신청</Link>
                </>
              )}
            </div>
            {mode === 'login' && (
              <Link className="recovery-link" to="/recover">
                <KeyRound size={13} /> 비밀번호를 잊으셨나요?
              </Link>
            )}
          </form>
        )}
      </section>
    </div>
  );
}
