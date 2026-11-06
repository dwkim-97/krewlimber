import {useState, type FormEvent} from 'react';
import {ChevronLeft, ChevronRight, Pin, Plus, Search} from 'lucide-react';
import {Link, useNavigate, useParams, useSearchParams} from 'react-router-dom';
import {EmptyState, ErrorNotice, Loading, PageHeading} from '@/components/ui';
import {useResource} from '@/hooks/useResource';
import {useSession} from '@/hooks/useSession';
import {api} from '@/apis/client';
import type {Notice, NoticeSummary, Page} from '@/types/boards';
import '@/styles/notices.css';

function date(value: string) {
  return new Date(value).toLocaleDateString('ko-KR', {year: 'numeric', month: '2-digit', day: '2-digit'});
}

export function Notices() {
  const {user} = useSession();
  const [search, setSearch] = useSearchParams();
  const query = search.get('q') ?? '';
  const page = search.get('page') ?? '1';
  const resource = useResource<Page<NoticeSummary>>(`/notices?${new URLSearchParams({q: query, page})}`);
  const data = resource.data;

  function searchNotices(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSearch({q: String(form.get('q') ?? '').trim(), page: '1'});
  }

  return (
    <div className="page-shell notices-page">
      <PageHeading title="공지사항">
        {user?.role === 'admin' && (
          <Link className="button button-dark button-small" to="/notices/new">
            <Plus size={16} />
            공지 작성
          </Link>
        )}
      </PageHeading>
      <form className="notice-search" role="search" onSubmit={searchNotices}>
        <label className="search-field">
          <Search size={17} aria-hidden="true" />
          <input
            key={query}
            type="search"
            aria-label="공지 검색"
            name="q"
            placeholder="제목 또는 본문 검색"
            defaultValue={query}
          />
        </label>
        <button className="button button-outline button-small" type="submit">
          검색
        </button>
      </form>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorNotice message={resource.error} retry={resource.reload} />
      ) : !data ? (
        <ErrorNotice message="공지사항을 불러오지 못했습니다." retry={resource.reload} />
      ) : data.items.length === 0 ? (
        <EmptyState
          title={query ? '검색 결과가 없습니다.' : '등록된 공지가 없습니다.'}
          description={query ? '다른 검색어로 찾아보세요.' : '새로운 소식을 기다려주세요.'}
        />
      ) : (
        <>
          <div className="notice-board-summary">전체 {data.total.toLocaleString()}개</div>
          <table className="notice-table">
            <caption className="notice-sr-only">공지사항 목록</caption>
            <thead>
              <tr>
                <th scope="col" className="notice-number">
                  번호
                </th>
                <th scope="col">제목</th>
                <th scope="col" className="notice-author">
                  작성자
                </th>
                <th scope="col" className="notice-date">
                  작성일
                </th>
                <th scope="col" className="notice-views">
                  조회
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((notice, index) => (
                <tr key={notice.id} className={notice.pinned ? 'notice-pinned-row' : ''}>
                  <td className="notice-number">
                    {notice.pinned ? (
                      <Pin size={14} aria-label="상단 고정" />
                    ) : (
                      data.total - (data.page - 1) * data.pageSize - index
                    )}
                  </td>
                  <td className="notice-title">
                    <Link to={`/notices/${notice.id}`}>
                      {notice.pinned && <span className="notice-pin-label">공지</span>}
                      {notice.title}
                    </Link>
                  </td>
                  <td className="notice-author">{notice.author}</td>
                  <td className="notice-date">
                    <time dateTime={notice.createdAt}>{date(notice.createdAt)}</time>
                  </td>
                  <td className="notice-views">{notice.views.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <nav className="notice-pagination" aria-label="공지 페이지">
            <button
              className="button button-outline button-small"
              aria-label="이전 페이지"
              disabled={data.page <= 1}
              onClick={() => setSearch({q: query, page: String(data.page - 1)})}
            >
              <ChevronLeft size={16} />
              이전
            </button>
            <span aria-live="polite">
              {data.page} / {Math.max(1, Math.ceil(data.total / data.pageSize))}
            </span>
            <button
              className="button button-outline button-small"
              aria-label="다음 페이지"
              disabled={data.page * data.pageSize >= data.total}
              onClick={() => setSearch({q: query, page: String(data.page + 1)})}
            >
              다음
              <ChevronRight size={16} />
            </button>
          </nav>
        </>
      )}
    </div>
  );
}

export function NoticeDetail() {
  const {id} = useParams();
  return <NoticeContent key={id} id={id ?? ''} />;
}

function NoticeContent({id}: {id: string}) {
  const {user} = useSession();
  const navigate = useNavigate();
  const resource = useResource<{notice: Notice}>(`/notices/${encodeURIComponent(id)}`);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const notice = resource.data?.notice;

  async function remove() {
    if (busy || !window.confirm('이 공지사항을 삭제할까요?')) return;
    setBusy(true);
    setError('');
    try {
      await api(`/admin/notices/${encodeURIComponent(id)}`, {method: 'DELETE'});
      navigate('/notices', {replace: true});
    } catch (error) {
      setError(error instanceof Error ? error.message : '공지사항을 삭제하지 못했습니다.');
      setBusy(false);
    }
  }

  return (
    <div className="page-shell notices-page">
      <Link className="text-link notice-back" to="/notices">
        <ChevronLeft size={16} />
        공지 목록
      </Link>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorNotice message={resource.error} retry={resource.reload} />
      ) : !notice ? (
        <ErrorNotice message="공지사항을 찾을 수 없습니다." retry={resource.reload} />
      ) : (
        <article className="notice-article">
          <header>
            {notice.pinned && (
              <span className="notice-pin-label">
                <Pin size={12} />
                상단 고정
              </span>
            )}
            <h1>{notice.title}</h1>
            <div className="notice-meta">
              <span>{notice.author}</span>
              <time dateTime={notice.createdAt}>{date(notice.createdAt)}</time>
              <span>조회 {notice.views.toLocaleString()}</span>
            </div>
          </header>
          <div className="notice-body">{notice.body}</div>
          {error && <ErrorNotice message={error} retry={null} />}
          {user?.role === 'admin' && (
            <div className="notice-actions">
              <Link className="button button-outline button-small" to={`/notices/${id}/edit`}>
                수정
              </Link>
              <button className="button button-outline button-small" disabled={busy} onClick={remove}>
                {busy ? '삭제 중…' : '삭제'}
              </button>
            </div>
          )}
        </article>
      )}
    </div>
  );
}

export function NoticeEditor() {
  const {id} = useParams();
  const {user} = useSession();
  if (user?.role !== 'admin')
    return (
      <div className="page-shell">
        <ErrorNotice message="관리자 권한이 필요합니다." retry={null} />
      </div>
    );
  return (
    <div className="page-shell notices-page">
      <PageHeading title={id ? '공지 수정' : '공지 작성'} />
      {id ? <ExistingNoticeEditor key={id} id={id} /> : <NoticeForm notice={null} />}
    </div>
  );
}

function ExistingNoticeEditor({id}: {id: string}) {
  const resource = useResource<{notice: Notice}>(`/notices/${encodeURIComponent(id)}`);
  if (resource.loading) return <Loading />;
  if (resource.error) return <ErrorNotice message={resource.error} retry={resource.reload} />;
  if (!resource.data?.notice) return <ErrorNotice message="공지사항을 찾을 수 없습니다." retry={resource.reload} />;
  return <NoticeForm notice={resource.data.notice} />;
}

function NoticeForm({notice}: {notice: Notice | null}) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(notice?.title ?? '');
  const [body, setBody] = useState(notice?.body ?? '');
  const [pinned, setPinned] = useState(notice?.pinned ?? false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await api<{notice: Notice}>(notice ? `/admin/notices/${notice.id}` : '/admin/notices', {
        method: notice ? 'PATCH' : 'POST',
        body: JSON.stringify({title: title.trim(), body: body.trim(), pinned}),
      });
      navigate(`/notices/${result.notice.id}`, {replace: true});
    } catch (error) {
      setError(error instanceof Error ? error.message : '공지사항을 저장하지 못했습니다.');
      setBusy(false);
    }
  }

  return (
    <form className="form-panel notice-editor" onSubmit={save}>
      {error && <ErrorNotice message={error} retry={null} />}
      <label>
        제목
        <input
          aria-label="제목"
          value={title}
          onChange={event => setTitle(event.target.value)}
          required
          maxLength={120}
        />
      </label>
      <label>
        본문
        <textarea
          aria-label="본문"
          value={body}
          onChange={event => setBody(event.target.value)}
          required
          maxLength={4000}
          rows={14}
        />
        <small>{body.length.toLocaleString()} / 4,000자</small>
      </label>
      <label className="notice-pin-control">
        <input type="checkbox" checked={pinned} onChange={event => setPinned(event.target.checked)} />
        상단 고정
      </label>
      <div className="notice-actions">
        <Link className="button button-outline button-small" to={notice ? `/notices/${notice.id}` : '/notices'}>
          취소
        </Link>
        <button className="button button-dark button-small" disabled={busy} type="submit">
          {busy ? '저장 중…' : notice ? '저장' : '등록'}
        </button>
      </div>
    </form>
  );
}
