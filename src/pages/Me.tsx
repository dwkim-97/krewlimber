import {Check, Clock3, KeyRound, LogOut, ShieldCheck} from 'lucide-react';
import {useState, type FormEvent} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {Achievements} from '@/components/Achievements';
import {Avatar, ErrorNotice, PageHeading, TextLink} from '@/components/ui';
import {useSession} from '@/hooks/useSession';
import {api} from '@/apis/client';
import type {User} from '@/types';
import {GRADES, STATUS_LABELS} from '@/consts';

export function Me() {
  const {user, refresh} = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'achievements' ? 'achievements' : 'profile';
  if (!user) return null;
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api<{user: User}>('/me', {method: 'PATCH', body: JSON.stringify(data)});
      await refresh();
      setMessage('프로필을 저장했어요.');
    } catch (error) {
      setError(error instanceof Error ? error.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (data.get('newPassword') !== data.get('confirm')) return setError('새 비밀번호가 일치하지 않습니다.');
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api('/me/password', {
        method: 'PATCH',
        body: JSON.stringify({currentPassword: data.get('currentPassword'), newPassword: data.get('newPassword')}),
      });
      await refresh();
      navigate('/login', {state: {notice: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.'}});
    } catch (error) {
      setError(error instanceof Error ? error.message : '변경하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError('');
    try {
      await api('/auth/logout', {method: 'POST'});
      await refresh();
      navigate('/');
    } catch (error) {
      setError(error instanceof Error ? error.message : '로그아웃하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }
  const approved = user.status === 'approved';
  return (
    <div className="page-shell">
      <PageHeading title="내 정보">{approved && <TextLink to="/me/orders">내 포인트·교환</TextLink>}</PageHeading>
      <div className="profile-layout">
        <aside className="profile-summary">
          <Avatar name={user.nickname} index={0} />
          <h2>{user.nickname}</h2>
          <p className="username">@{user.username}</p>
          <span className={`status-tag status-${user.status}`}>
            {approved ? <ShieldCheck size={14} /> : <Clock3 size={14} />}
            {STATUS_LABELS[user.status]}
          </span>
          {user.role === 'admin' && <span className="admin-label">관리자</span>}
          <div className="summary-grade">
            <span>주요 난이도</span>
            <strong>{user.grade}</strong>
          </div>
          <button className="text-button logout-button" disabled={busy} onClick={logout}>
            <LogOut size={15} />
            로그아웃
          </button>
        </aside>
        <div className="profile-content">
          <div className="tabs" aria-label="내 정보 메뉴">
            <button className={tab === 'profile' ? 'active' : ''} onClick={() => setParams({tab: 'profile'})}>
              프로필
            </button>
            <button className={tab === 'achievements' ? 'active' : ''} onClick={() => setParams({tab: 'achievements'})}>
              업적
            </button>
          </div>
          {!approved && (
            <div className={`notice ${user.status === 'pending' ? 'notice-lime' : ''}`}>
              <Clock3 size={21} />
              <div>
                <strong>
                  {user.status === 'pending' ? '운영진이 가입 신청을 확인하고 있어요.' : '가입 상태를 확인해주세요.'}
                </strong>
                <p>
                  {user.status === 'pending'
                    ? '승인이 완료되면 멤버 공간을 이용할 수 있어요. 먼저 내 프로필을 채워보세요.'
                    : '자세한 내용은 동호회 운영진에게 문의해주세요.'}
                </p>
              </div>
            </div>
          )}
          {message && (
            <div className="notice success" role="status">
              <Check size={18} />
              {message}
            </div>
          )}
          {error && <ErrorNotice message={error} retry={null} />}
          {tab === 'achievements' ? (
            <Achievements key={user.id} />
          ) : (
            <>
              {' '}
              <section className="form-panel">
                <div className="panel-title">
                  <h2>프로필</h2>
                </div>
                <form onSubmit={saveProfile} key={`${user.id}-${user.nickname}-${user.grade}`}>
                  <div className="form-grid">
                    <label>
                      닉네임
                      <input
                        name="nickname"
                        defaultValue={user.nickname}
                        required
                        minLength={2}
                        maxLength={20}
                        autoComplete="nickname"
                      />
                    </label>
                    <label>
                      주요 난이도
                      <select name="grade" defaultValue={user.grade}>
                        {GRADES.map(grade => (
                          <option key={grade}>{grade}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      주 활동 지역
                      <input
                        name="location"
                        defaultValue={user.location}
                        placeholder="예: 서울 · 경기"
                        maxLength={30}
                      />
                    </label>
                    <label>
                      주 활동 암장
                      <input
                        name="gym"
                        defaultValue={user.gym}
                        placeholder="자주 오르는 암장을 알려주세요"
                        maxLength={50}
                      />
                    </label>
                  </div>
                  <label>
                    한 줄 소개
                    <textarea
                      name="bio"
                      defaultValue={user.bio}
                      placeholder="어떤 클라이머인가요? 크루에게 나를 소개해보세요."
                      maxLength={200}
                      rows={3}
                    />
                  </label>
                  <div className="form-footer">
                    <button className="button button-dark button-small" disabled={busy}>
                      프로필 저장
                      <Check size={16} />
                    </button>
                  </div>
                </form>
              </section>
              <section className="form-panel">
                <div className="panel-title">
                  <h2>
                    <KeyRound size={19} />
                    비밀번호 변경
                  </h2>
                </div>
                <form onSubmit={changePassword}>
                  <label>
                    현재 비밀번호
                    <input
                      name="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      required
                      maxLength={128}
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      새 비밀번호
                      <input
                        name="newPassword"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={4}
                        maxLength={128}
                        placeholder="4자 이상"
                      />
                    </label>
                    <label>
                      새 비밀번호 확인
                      <input
                        name="confirm"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={4}
                        maxLength={128}
                      />
                    </label>
                  </div>
                  <div className="form-footer">
                    <span>변경 후 모든 기기에서 다시 로그인해야 해요.</span>
                    <button className="button button-outline button-small" disabled={busy}>
                      비밀번호 변경
                    </button>
                  </div>
                </form>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
