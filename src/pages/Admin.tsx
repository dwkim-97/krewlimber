import {ROLE_LABELS} from '@/consts/roles';
import {Check, KeyRound, ShieldCheck} from 'lucide-react';
import {useState, type FormEvent} from 'react';
import {AdminMarket} from '@/components/AdminMarket';
import {AdminProgression} from '@/components/AdminProgression';
import {Avatar, EmptyState, ErrorNotice, Loading, PageHeading} from '@/components/ui';
import {useResource} from '@/hooks/useResource';
import {useSession} from '@/hooks/useSession';
import {api} from '@/apis/client';
import type {MemberStatus, User} from '@/types';
import {STATUS_LABELS} from '@/consts';

function AdminMembers() {
  const members = useResource<{users: User[]}>('/admin/users');
  const {user, refresh} = useSession();
  const [filter, setFilter] = useState<MemberStatus | 'all'>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [recovery, setRecovery] = useState<{username: string; token: string; expiresAt: number} | null>(null);
  async function update(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api(`/admin/users/${id}`, {method: 'PATCH', body: JSON.stringify(data)});
      members.reload();
      await refresh();
      setMessage('회원 정보를 저장했습니다.');
    } catch (error) {
      setError(error instanceof Error ? error.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }
  async function recover(member: User) {
    if (!window.confirm(`${member.nickname}님의 신원을 확인하셨나요? 30분 동안 유효한 복구 코드를 발급합니다.`)) return;
    setBusy(true);
    setError('');
    setRecovery(null);
    try {
      const result = await api<{token: string; expiresAt: number}>(`/admin/users/${member.id}/recovery`, {
        method: 'POST',
      });
      setRecovery({...result, username: member.username});
    } catch (error) {
      setError(error instanceof Error ? error.message : '발급하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }
  const users = members.data?.users.filter(member => filter === 'all' || member.status === filter) ?? [];
  return (
    <>
      {error && <ErrorNotice message={error} retry={null} />}{' '}
      {message && (
        <div className="notice success" role="status">
          <Check size={17} />
          {message}
        </div>
      )}
      {recovery && (
        <div className="recovery-panel">
          <strong>{recovery.username} 복구 코드</strong>
          <code>{recovery.token}</code>
          <p>
            {new Date(recovery.expiresAt).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})}까지 ·
            본인에게 직접 전달해주세요.
          </p>
          <button className="text-button" onClick={() => setRecovery(null)}>
            숨기기
          </button>
        </div>
      )}
      <div className="member-filters">
        <label>
          가입 상태
          <select value={filter} onChange={event => setFilter(event.target.value as MemberStatus | 'all')}>
            <option value="all">전체 회원</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {members.loading ? (
        <Loading />
      ) : members.error ? (
        <ErrorNotice message={members.error} retry={members.reload} />
      ) : users.length ? (
        <div className="admin-user-list">
          {users.map((member, index) => (
            <article className="admin-user" key={`${member.id}-${member.status}-${member.role}`}>
              <div className="admin-user-info">
                <Avatar name={member.nickname} index={index} />
                <div>
                  <h3>
                    {member.nickname}
                    {member.id === user?.id && <small>나</small>}
                  </h3>
                  <span>
                    {member.fullName ? `${member.fullName} · ` : ''}@{member.username}
                  </span>
                </div>
                <span className={`status-tag status-${member.status}`}>{STATUS_LABELS[member.status]}</span>
              </div>
              <form className="admin-user-form" onSubmit={event => update(event, member.id)}>
                <label>
                  상태
                  <select name="status" defaultValue={member.status}>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  권한
                  <select name="role" defaultValue={member.role}>
                    <option value="member">회원</option>
                    <option value="staff">운영진</option>
                    <option value="admin">관리자</option>
                  </select>
                </label>
                <label className="reason-field">
                  처리 사유
                  <input name="reason" maxLength={200} />
                </label>
                <button className="button button-dark button-small" disabled={busy}>
                  저장
                </button>
                <button
                  className="icon-button"
                  type="button"
                  aria-label={`${member.nickname} 비밀번호 복구 코드 발급`}
                  disabled={busy}
                  onClick={() => recover(member)}
                >
                  <KeyRound size={19} />
                </button>
              </form>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="해당하는 회원이 없어요" description="다른 가입 상태를 선택해보세요." />
      )}
    </>
  );
}

export function Admin() {
  const {user} = useSession();
  const [tab, setTab] = useState<'members' | 'activity' | 'achievements' | 'market'>('members');
  return (
    <div className="page-shell">
      <PageHeading title="크루 관리">
        <span className="count-pill">
          <ShieldCheck size={17} />
          {user ? ROLE_LABELS[user.role] : '운영진'}
        </span>
      </PageHeading>
      <div className="tabs admin-tabs">
        <button className={tab === 'members' ? 'active' : ''} onClick={() => setTab('members')}>
          회원 관리
        </button>
        <button className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}>
          분기 기록
        </button>
        <button className={tab === 'achievements' ? 'active' : ''} onClick={() => setTab('achievements')}>
          업적 관리
        </button>
        <button className={tab === 'market' ? 'active' : ''} onClick={() => setTab('market')}>
          마켓 관리
        </button>
      </div>
      {tab === 'members' ? (
        <AdminMembers />
      ) : tab === 'market' ? (
        <AdminMarket />
      ) : (
        <AdminProgression key={tab} mode={tab} />
      )}
    </div>
  );
}
