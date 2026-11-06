import {useState, type FormEvent} from 'react';
import {useResource} from '@/hooks/useResource';
import {api} from '@/apis/client';
import {ErrorNotice, Loading} from '@/components/ui';
interface Comment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  canDelete: boolean;
}
export function GymComments({gymId}: {gymId: string}) {
  const r = useResource<{comments: Comment[]}>(`/gyms/${gymId}/comments`);
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api(editing ? `/gyms/${gymId}/comments/${editing}` : `/gyms/${gymId}/comments`, {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify({body}),
      });
      setMessage(editing ? '댓글을 수정했어요.' : '소식을 공유했어요.');
      setBody('');
      setEditing(null);
      r.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (!window.confirm('이 댓글을 삭제할까요?')) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api(`/gyms/${gymId}/comments/${id}`, {method: 'DELETE'});
      if (editing === id) {
        setEditing(null);
        setBody('');
      }
      r.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="gym-comments" aria-label="암장 최신 현황">
      <h3>회원들이 전하는 최신 현황</h3>
      <p className="climbing-help">
        세팅 변경, 혼잡도, 시설 소식 등을 나눠주세요. 최근 댓글 100개를 최신순으로 보여드려요.
      </p>
      <form onSubmit={save}>
        <label>
          {editing ? '댓글 수정' : '현황 공유하기'}
          <textarea
            required
            maxLength={1000}
            rows={3}
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="예: 오늘 보라 구역 새로 세팅됐어요"
          />
        </label>
        <div className="climbing-actions">
          <button className="button button-dark button-small" aria-busy={busy} disabled={busy || !body.trim()}>
            {busy ? '저장 중…' : editing ? '수정 저장' : '댓글 등록'}
          </button>
          {editing && (
            <button
              className="text-button"
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(null);
                setBody('');
              }}
            >
              취소
            </button>
          )}
        </div>
      </form>
      {message && (
        <p className="action-success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {r.loading ? (
        <Loading />
      ) : r.error ? (
        <ErrorNotice message={r.error} retry={r.reload} />
      ) : !r.data?.comments.length ? (
        <p>아직 공유된 소식이 없어요. 첫 소식을 남겨보세요.</p>
      ) : (
        r.data.comments.map(c => (
          <article className="gym-comment" key={c.id}>
            <div className="climbing-actions">
              <strong>{c.author}</strong>
              <time dateTime={c.createdAt}>
                {new Date(c.createdAt).toLocaleString('ko-KR')}
                {c.updatedAt !== c.createdAt ? ' · 수정됨' : ''}
              </time>
            </div>
            <p>{c.body}</p>
            <div className="climbing-actions">
              {c.canEdit && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    setEditing(c.id);
                    setBody(c.body);
                  }}
                >
                  수정
                </button>
              )}
              {c.canDelete && (
                <button className="text-button" disabled={busy} onClick={() => remove(c.id)}>
                  삭제
                </button>
              )}
            </div>
          </article>
        ))
      )}
    </section>
  );
}
