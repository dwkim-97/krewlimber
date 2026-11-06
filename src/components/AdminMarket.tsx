import {Plus, Search} from 'lucide-react';
import {useRef, useState, type FormEvent} from 'react';
import {ProductForm} from '@/components/ProductForm';
import {EmptyState, ErrorNotice, Loading} from '@/components/ui';
import {useResource} from '@/hooks/useResource';
import {api, ApiRequestError} from '@/apis/client';
import type {User} from '@/types';
import type {MarketOrder, OrderStatus, Page, Product, ProductCategory, Wallet} from '@/types/boards';
import '@/styles/market.css';

const categories: {id: ProductCategory; label: string}[] = [
  {id: 'gear', label: '클라이밍 용품'},
  {id: 'apparel', label: '크루 의류'},
  {id: 'voucher', label: '이용권'},
  {id: 'other', label: '기타'},
];
function AdminProducts() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const products = useResource<Page<Product>>(
    `/admin/market/products?${new URLSearchParams({q: query, page: String(page)})}`
  );
  const [editor, setEditor] = useState<{product: Product | null} | null>(null);
  const [message, setMessage] = useState('');
  return (
    <>
      <div className="market-toolbar">
        <form
          className="market-search"
          onSubmit={event => {
            event.preventDefault();
            setQuery(String(new FormData(event.currentTarget).get('q') ?? '').trim());
            setPage(1);
          }}
        >
          <input name="q" aria-label="관리 상품 검색" placeholder="상품 이름 검색" maxLength={100} />
          <button aria-label="검색">
            <Search size={18} />
          </button>
        </form>
        <button
          className="button button-dark button-small"
          onClick={() => {
            setEditor({product: null});
            setMessage('');
          }}
        >
          <Plus size={17} /> 상품 등록
        </button>
      </div>
      {message && (
        <div className="notice success" role="status">
          {message}
        </div>
      )}
      {editor && (
        <div>
          <div className="panel-title">
            <h2>{editor.product ? '상품 수정' : '새 상품'}</h2>
          </div>
          <ProductForm
            key={editor.product ? `${editor.product.id}:${editor.product.revision}` : 'new'}
            product={editor.product}
            onCancel={() => setEditor(null)}
            onSaved={() => {
              products.reload();
              setEditor(null);
              setMessage('상품을 저장했습니다.');
            }}
          />
        </div>
      )}
      {products.loading ? (
        <Loading />
      ) : products.error ? (
        <ErrorNotice message={products.error} retry={products.reload} />
      ) : products.data?.items.length ? (
        <>
          <div className="market-admin-products">
            {products.data.items.map(product => (
              <article className="market-admin-product" key={product.id}>
                <div>
                  <span className="market-muted">
                    {categories.find(category => category.id === product.category)?.label}
                  </span>
                  <h3>{product.name}</h3>
                  <p>
                    {product.points.toLocaleString('ko-KR')} P · 재고 {product.stock}개
                  </p>
                </div>
                <span className={`order-status ${product.active ? 'order-status-pending' : 'order-status-cancelled'}`}>
                  {product.active ? '판매 중' : '판매 중지'}
                </span>
                <button
                  className="button button-outline button-small"
                  onClick={() => {
                    setEditor({product});
                    setMessage('');
                  }}
                >
                  수정
                </button>
              </article>
            ))}
          </div>
          <nav className="market-pagination" aria-label="관리 상품 페이지">
            <button disabled={products.data.page <= 1} onClick={() => setPage(products.data!.page - 1)}>
              이전
            </button>
            <span>
              {products.data.page} / {Math.max(1, Math.ceil(products.data.total / products.data.pageSize))}
            </span>
            <button
              disabled={products.data.page * products.data.pageSize >= products.data.total}
              onClick={() => setPage(products.data!.page + 1)}
            >
              다음
            </button>
          </nav>
        </>
      ) : (
        <EmptyState title="등록된 상품이 없어요" description="새 상품을 등록하거나 검색어를 바꿔보세요." />
      )}
    </>
  );
}

function MemberPoints({userId}: {userId: string}) {
  const wallet = useResource<Wallet>(`/admin/points?userId=${encodeURIComponent(userId)}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const saving = useRef(false);
  const request = useRef<{userId: string; amount: number; reason: string; requestId: string} | null>(null);
  async function grant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const amount = Number(data.get('amount'));
    if (!Number.isSafeInteger(amount) || amount === 0) {
      setError('0이 아닌 정수 포인트를 입력해주세요.');
      return;
    }
    saving.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    const reason = String(data.get('reason') ?? '').trim();
    if (!request.current || request.current.amount !== amount || request.current.reason !== reason)
      request.current = {userId, amount, reason, requestId: crypto.randomUUID()};
    try {
      const updated = await api<Wallet>('/admin/points', {
        method: 'POST',
        body: JSON.stringify(request.current),
      });
      wallet.setData(updated);
      request.current = null;
      form.reset();
      setMessage('포인트를 반영했습니다.');
    } catch (error) {
      if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) request.current = null;
      setError(error instanceof Error ? error.message : '포인트를 반영하지 못했습니다.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      {error && <ErrorNotice message={error} retry={null} />}
      {message && (
        <div className="notice success" role="status">
          {message}
        </div>
      )}
      {wallet.loading ? (
        <Loading />
      ) : wallet.error ? (
        <ErrorNotice message={wallet.error} retry={wallet.reload} />
      ) : (
        wallet.data && (
          <>
            <p className="admin-wallet-balance">
              보유 포인트 <strong>{wallet.data.balance.toLocaleString('ko-KR')} P</strong>
            </p>
            <form
              onSubmit={grant}
              onChange={() => {
                request.current = null;
              }}
            >
              <div className="form-grid">
                <label>
                  지급·정정 포인트
                  <input
                    name="amount"
                    type="number"
                    required
                    step={1}
                    min={-1000000}
                    max={1000000}
                    placeholder="예: 500 또는 -100"
                  />
                </label>
                <label>
                  사유
                  <input name="reason" required minLength={2} maxLength={100} placeholder="예: 크루 활동 보상" />
                </label>
              </div>
              <div className="form-footer">
                <span>음수로 정정할 수 있어요. 잔액보다 많이 차감할 수 없어요.</span>
                <button className="button button-dark button-small" disabled={busy}>
                  포인트 반영
                </button>
              </div>
            </form>
            <h3 className="market-subtitle">최근 포인트 내역</h3>
            <ul className="point-entry-list">
              {wallet.data.entries.map(entry => (
                <li key={entry.id}>
                  <div>
                    <strong>{entry.reason}</strong>
                    <span>
                      {new Date(entry.createdAt).toLocaleDateString('ko-KR')} · {entry.actor}
                    </span>
                  </div>
                  <strong>
                    {entry.amount > 0 ? '+' : ''}
                    {entry.amount.toLocaleString('ko-KR')} P
                  </strong>
                </li>
              ))}
            </ul>
          </>
        )
      )}
    </>
  );
}

function AdminPoints() {
  const members = useResource<{users: User[]}>('/admin/users');
  const [selected, setSelected] = useState('');
  const approved = members.data?.users.filter(user => user.status === 'approved') ?? [];
  return (
    <section className="form-panel">
      <div className="panel-title">
        <h2>포인트 지급·정정</h2>
      </div>
      {members.loading ? (
        <Loading />
      ) : members.error ? (
        <ErrorNotice message={members.error} retry={members.reload} />
      ) : approved.length ? (
        <>
          <label>
            회원 선택
            <select value={selected} onChange={event => setSelected(event.target.value)}>
              <option value="">회원을 선택해주세요</option>
              {approved.map(user => (
                <option key={user.id} value={user.id}>
                  {user.nickname} (@{user.username})
                </option>
              ))}
            </select>
          </label>
          {selected && <MemberPoints key={selected} userId={selected} />}
        </>
      ) : (
        <p className="market-muted">승인된 회원이 없어요.</p>
      )}
    </section>
  );
}

function AdminOrders() {
  const [status, setStatus] = useState<OrderStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const orders = useResource<Page<MarketOrder>>(`/admin/market/orders?status=${status}&page=${page}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const processing = useRef(false);
  async function process(order: MarketOrder, nextStatus: 'completed' | 'cancelled') {
    if (processing.current) return;
    processing.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api(`/admin/market/orders/${order.id}`, {method: 'PATCH', body: JSON.stringify({status: nextStatus})});
      orders.reload();
      setMessage(nextStatus === 'completed' ? '교환을 완료 처리했습니다.' : '신청을 취소하고 포인트를 반환했습니다.');
    } catch (error) {
      setError(error instanceof Error ? error.message : '신청을 처리하지 못했습니다.');
      orders.reload();
    } finally {
      processing.current = false;
      setBusy(false);
    }
  }
  const labels = {all: '전체', pending: '처리 대기', completed: '교환 완료', cancelled: '취소됨'};
  return (
    <>
      {error && <ErrorNotice message={error} retry={null} />}
      {message && (
        <div className="notice success" role="status">
          {message}
        </div>
      )}
      <div className="market-categories" aria-label="교환 상태">
        {(Object.keys(labels) as (OrderStatus | 'all')[]).map(value => (
          <button
            className={status === value ? 'active' : ''}
            key={value}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
          >
            {labels[value]}
          </button>
        ))}
      </div>
      <p className="market-policy">
        대기 신청만 완료·취소할 수 있어요. 취소 시 포인트·재고가 반환되며, 완료 후에는 취소할 수 없어요.
      </p>
      {orders.loading ? (
        <Loading />
      ) : orders.error ? (
        <ErrorNotice message={orders.error} retry={orders.reload} />
      ) : orders.data?.items.length ? (
        <>
          <div className="market-order-list">
            {orders.data.items.map(order => (
              <article className="market-order" key={order.id}>
                <div className="market-order-main">
                  <span className="market-muted">
                    {new Date(order.createdAt).toLocaleDateString('ko-KR')} · {order.nickname} (@{order.username})
                  </span>
                  <h3>{order.productName}</h3>
                  <p>
                    {order.quantity}개 · {order.total.toLocaleString('ko-KR')} P
                  </p>
                </div>
                <span className={`order-status order-status-${order.status}`}>{labels[order.status]}</span>
                {order.status === 'pending' && (
                  <div className="market-order-actions">
                    <button
                      className="button button-dark button-small"
                      disabled={busy}
                      onClick={() => process(order, 'completed')}
                    >
                      완료 처리
                    </button>
                    <button
                      className="button button-outline button-small"
                      disabled={busy}
                      onClick={() => process(order, 'cancelled')}
                    >
                      취소·환불
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
          <nav className="market-pagination" aria-label="관리 교환 페이지">
            <button disabled={orders.data.page <= 1} onClick={() => setPage(orders.data!.page - 1)}>
              이전
            </button>
            <span>
              {orders.data.page} / {Math.max(1, Math.ceil(orders.data.total / orders.data.pageSize))}
            </span>
            <button
              disabled={orders.data.page * orders.data.pageSize >= orders.data.total}
              onClick={() => setPage(orders.data!.page + 1)}
            >
              다음
            </button>
          </nav>
        </>
      ) : (
        <EmptyState
          title="해당하는 교환 신청이 없어요"
          description="새 교환 신청이 생기면 이곳에서 처리할 수 있어요."
        />
      )}
    </>
  );
}

export function AdminMarket() {
  const [tab, setTab] = useState<'products' | 'points' | 'orders'>('products');
  return (
    <div className="admin-market">
      <div className="market-categories admin-market-tabs" aria-label="마켓 관리 메뉴">
        {(
          [
            {id: 'products', label: '상품 관리'},
            {id: 'points', label: '포인트 지급'},
            {id: 'orders', label: '교환 처리'},
          ] as const
        ).map(item => (
          <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'products' ? <AdminProducts /> : tab === 'points' ? <AdminPoints /> : <AdminOrders />}
    </div>
  );
}
