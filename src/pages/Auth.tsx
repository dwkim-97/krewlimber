import {ArrowUpRight, Check, KeyRound} from 'lucide-react';
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
      <aside className="auth-aside auth-aside-mascot">
        <img src="/chun-sik-02.webp" alt="초크백을 준비하는 춘식이" width={1080} height={1080} />
      </aside>
      <section className="auth-form-wrap">
        <h1>{recovery ? '비밀번호 재설정' : signup ? '회원 가입' : '로그인'}</h1>
        {recovery && <p className="auth-description">운영진에게 받은 복구 코드를 입력해주세요.</p>}
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
              {signup && <small>영문으로 시작하는 3~32자 · 숫자, . _ - 사용 가능</small>}
            </label>
            {signup && (
              <label>
                닉네임
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
                <span>가입 후 운영진 승인이 필요합니다.</span>
              </div>
            )}
            {typeof (location.state as {notice: unknown} | null)?.notice === 'string' && (
              <div className="notice success" role="status">
                {(location.state as {notice: string}).notice}
              </div>
            )}
            {error && <ErrorNotice message={error} retry={null} />}
            <button className="button button-dark button-full" disabled={busy}>
              {busy ? '처리 중…' : recovery ? '새 비밀번호 설정' : signup ? '가입 신청' : '로그인'}
              <ArrowUpRight size={18} />
            </button>
            <div className="auth-switch">
              {signup ? (
                <>
                  이미 계정이 있나요? <Link to="/login">로그인</Link>
                </>
              ) : recovery ? (
                <Link to="/login">로그인으로 돌아가기</Link>
              ) : (
                <>
                  처음 오셨나요? <Link to="/signup">가입 신청</Link>
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
