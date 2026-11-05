import {Check, KeyRound, Plus, ShieldCheck, Trash2, Users} from 'lucide-react';
import {useState, type FormEvent} from 'react';
import {Avatar, EmptyState, ErrorNotice, Loading, PageHeading} from '@/components/ui';
import {useResource} from '@/hooks/useResource';
import {useSession} from '@/hooks/useSession';
import {api} from '@/apis/client';
import type {Honor, MemberStatus, User} from '@/types';
import {HONOR_LABELS, STATUS_LABELS} from '@/consts';

export function Admin() {
  const members = useResource<{users: User[]}>('/admin/users');
  const records = useResource<{honors: Honor[]}>('/admin/honors');
  const {user, refresh} = useSession();
  const [tab, setTab] = useState<'members' | 'honors'>('members');
  const [filter, setFilter] = useState<MemberStatus | 'all'>('pending');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [recovery, setRecovery] = useState<{username: string; token: string; expiresAt: number} | null>(null);
  const users = members.data?.users ?? [];
  const pending = users.filter(member => member.status === 'pending').length;
  async function updateMember(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api(`/admin/users/${id}`, {method: 'PATCH', body: JSON.stringify(data)});
      members.reload();
      await refresh();
      setMessage('회원 정보를 변경했어요.');
    } catch (error) {
      setError(error instanceof Error ? error.message : '변경하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }
  async function issueRecovery(member: User) {
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
      setError(error instanceof Error ? error.message : '코드를 발급하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }
  async function addHonor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api('/admin/honors', {method: 'POST', body: JSON.stringify(data)});
      form.reset();
      records.reload();
      setMessage('크루의 멋진 순간을 등록했어요.');
    } catch (error) {
      setError(error instanceof Error ? error.message : '등록하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }
  async function removeHonor(honor: Honor) {
    if (!window.confirm(`“${honor.title}” 기록을 삭제할까요?`)) return;
    setBusy(true);
    setError('');
    try {
      await api(`/admin/honors/${honor.id}`, {method: 'DELETE'});
      records.reload();
      setMessage('기록을 삭제했어요.');
    } catch (error) {
      setError(error instanceof Error ? error.message : '삭제하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-shell">
      <PageHeading
        eyebrow="CREW MANAGEMENT"
        title="더 좋은 크루를 위해"
        description="새로운 멤버를 맞이하고, 크루의 멋진 순간을 기록하세요."
      >
        <span className="count-pill">
          <ShieldCheck size={17} />
          운영진 전용
        </span>
      </PageHeading>
      <div className="admin-stats">
        <div>
          <span>가입 승인 대기</span>
          <strong>
            {pending}
            <small>명</small>
          </strong>
        </div>
        <div>
          <span>활동 중인 크루</span>
          <strong>
            {users.filter(member => member.status === 'approved').length}
            <small>명</small>
          </strong>
        </div>
        <div>
          <span>함께 만든 기록</span>
          <strong>
            {records.data?.honors.length ?? 0}
            <small>개</small>
          </strong>
        </div>
      </div>
      <div className="tabs admin-tabs">
        <button className={tab === 'members' ? 'active' : ''} onClick={() => setTab('members')}>
          <Users size={16} />
          회원 관리{pending > 0 && <span className="tab-count">{pending}</span>}
        </button>
        <button className={tab === 'honors' ? 'active' : ''} onClick={() => setTab('honors')}>
          명예의 전당 관리
        </button>
      </div>
      {error && <ErrorNotice message={error} retry={null} />}
      {message && (
        <div className="notice success" role="status">
          <Check size={17} />
          {message}
        </div>
      )}
      {recovery && (
        <div className="recovery-panel" role="status">
          <div>
            <strong>{recovery.username}님의 비밀번호 복구 코드</strong>
            <p>
              본인에게 직접 전달해주세요. 유효 시간:{' '}
              {new Date(recovery.expiresAt).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})}까지 ·
              일회용
            </p>
          </div>
          <code>{recovery.token}</code>
          <p>로그인 화면 → 비밀번호를 잊으셨나요?에서 사용합니다.</p>
          <button className="text-button" onClick={() => setRecovery(null)}>
            코드 숨기기
          </button>
        </div>
      )}
      {tab === 'members' ? (
        <>
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
          ) : !users.some(member => filter === 'all' || member.status === filter) ? (
            <EmptyState
              title="확인이 필요한 회원이 없어요"
              description="새로운 가입 신청이 들어오면 이곳에서 확인할 수 있어요."
            />
          ) : (
            <div className="admin-user-list">
              {users
                .filter(member => filter === 'all' || member.status === filter)
                .map((member, index) => (
                  <article className="admin-user" key={`${member.id}-${member.status}-${member.role}`}>
                    <div className="admin-user-info">
                      <Avatar name={member.nickname} index={index} />
                      <div>
                        <h3>
                          {member.nickname}
                          {member.id === user?.id && <small>나</small>}
                        </h3>
                        <span>
                          @{member.username} · {member.createdAt.slice(0, 10)}
                        </span>
                      </div>
                      <span className={`status-tag status-${member.status}`}>{STATUS_LABELS[member.status]}</span>
                    </div>
                    <form className="admin-user-form" onSubmit={event => updateMember(event, member.id)}>
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
                          <option value="admin">관리자</option>
                        </select>
                      </label>
                      <label className="reason-field">
                        처리 사유
                        <input name="reason" placeholder="변경 사유를 남겨주세요" maxLength={200} />
                      </label>
                      <button className="button button-dark button-small" disabled={busy}>
                        변경 저장
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        title="비밀번호 복구 코드 발급"
                        aria-label={`${member.nickname} 비밀번호 복구 코드 발급`}
                        disabled={busy}
                        onClick={() => issueRecovery(member)}
                      >
                        <KeyRound size={19} />
                      </button>
                    </form>
                  </article>
                ))}
            </div>
          )}
        </>
      ) : (
        <div className="admin-honors-layout">
          <section className="form-panel">
            <div className="panel-title">
              <h2>새로운 순간 기록하기</h2>
              <Plus size={19} />
            </div>
            {members.error ? (
              <ErrorNotice message={members.error} retry={members.reload} />
            ) : members.loading ? (
              <Loading />
            ) : (
              <form onSubmit={addHonor}>
                <label>
                  기록의 주인공
                  <select name="userId" required defaultValue="">
                    <option value="" disabled>
                      활동 중인 회원을 선택해주세요
                    </option>
                    {users
                      .filter(member => member.status === 'approved')
                      .map(member => (
                        <option value={member.id} key={member.id}>
                          {member.nickname} (@{member.username})
                        </option>
                      ))}
                  </select>
                </label>
                <div className="form-grid">
                  <label>
                    기록 종류
                    <select name="kind">
                      {Object.entries(HONOR_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    달성일
                    <input name="achievedAt" type="date" required />
                  </label>
                </div>
                <label>
                  제목
                  <input
                    name="title"
                    placeholder="예: 포기하지 않고 완성한 첫 V4"
                    required
                    minLength={2}
                    maxLength={60}
                  />
                </label>
                <label>
                  함께 기억할 이야기
                  <textarea
                    name="description"
                    placeholder="크루의 도전과 성장을 소개해주세요."
                    required
                    maxLength={500}
                    rows={4}
                  />
                </label>
                <button className="button button-dark button-full" disabled={busy}>
                  기록 등록하기
                  <Plus size={17} />
                </button>
              </form>
            )}
          </section>
          <section>
            <h2 className="list-title">등록된 기록</h2>
            {records.loading ? (
              <Loading />
            ) : records.error ? (
              <ErrorNotice message={records.error} retry={records.reload} />
            ) : records.data?.honors.length ? (
              <div className="admin-honor-list">
                {records.data.honors.map(honor => (
                  <div key={honor.id}>
                    <div>
                      <span>
                        {HONOR_LABELS[honor.kind]} · {honor.achievedAt}
                      </span>
                      <h3>{honor.title}</h3>
                      <p>{honor.nickname}</p>
                    </div>
                    <button
                      className="icon-button danger"
                      disabled={busy}
                      aria-label={`${honor.title} 삭제`}
                      onClick={() => removeHonor(honor)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="아직 등록된 기록이 없어요" description="첫 번째 크루의 순간을 남겨주세요." />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
