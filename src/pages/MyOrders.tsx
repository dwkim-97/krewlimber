import {ArrowUpRight, Coins, ShoppingBag} from 'lucide-react';
import {useRef, useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {EmptyState, ErrorNotice, Loading, PageHeading} from '@/components/ui';
import {useResource} from '@/hooks/useResource';
import {api} from '@/apis/client';
import type {MarketOrder, Page, Wallet} from '@/types/boards';
import '@/styles/market.css';

const statusLabels = {pending: '처리 대기', completed: '교환 완료', cancelled: '취소됨'};

export function MyOrders() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const wallet = useResource<Wallet>('/me/wallet');
  const orders = useResource<Page<MarketOrder>>(`/me/orders?page=${page}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const cancelling = useRef(false);
  async function cancel(order: MarketOrder) {
    if (cancelling.current) return;
    cancelling.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api(`/market/orders/${order.id}/cancel`, {method: 'PATCH'});
      setMessage('신청을 취소하고 포인트를 반환했어요.');
      orders.reload();
      wallet.reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : '취소하지 못했습니다.');
      orders.reload();
    } finally {
      cancelling.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="page-shell market-page">
      <PageHeading title="내 교환 내역">
        <Link className="text-link" to="/market">
          포인트 마켓 <ArrowUpRight size={17} />
        </Link>
      </PageHeading>
      {error && <ErrorNotice message={error} retry={null} />}
      {message && (
        <div className="notice success" role="status">
          {message}
        </div>
      )}
      <section className="form-panel wallet-panel">
        <div className="panel-title">
          <h2>
            <Coins size={21} /> 내 포인트
          </h2>
          {!wallet.loading && !wallet.error && wallet.data && (
            <strong className="wallet-balance">{wallet.data.balance.toLocaleString('ko-KR')} P</strong>
          )}
        </div>
        {wallet.loading ? (
          <Loading />
        ) : wallet.error ? (
          <ErrorNotice message={wallet.error} retry={wallet.reload} />
        ) : (
          <>
            <h3 className="market-subtitle">최근 포인트 내역 · 최대 20건</h3>
            {wallet.data?.entries.length ? (
              <ul className="point-entry-list">
                {wallet.data.entries.map(entry => (
                  <li key={entry.id}>
                    <div>
                      <strong>{entry.reason}</strong>
                      <span>
                        {new Date(entry.createdAt).toLocaleDateString('ko-KR')} · {entry.actor}
                      </span>
                    </div>
                    <strong className={entry.amount > 0 ? 'point-positive' : ''}>
                      {entry.amount > 0 ? '+' : ''}
                      {entry.amount.toLocaleString('ko-KR')} P
                    </strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="market-muted">아직 포인트 내역이 없어요.</p>
            )}
          </>
        )}
      </section>
      <section className="market-orders">
        <div className="panel-title">
          <h2>교환 신청</h2>
          <span className="market-muted">{orders.data?.total ?? 0}건</span>
        </div>
        <p className="market-policy">
          처리 대기 중 취소하면 포인트와 재고가 전액 반환돼요. 완료 후에는 취소할 수 없어요.
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
                  <div className="order-icon">
                    <ShoppingBag size={25} />
                  </div>
                  <div className="market-order-main">
                    <span className="market-muted">{new Date(order.createdAt).toLocaleDateString('ko-KR')}</span>
                    <h3>{order.productName}</h3>
                    <p>
                      {order.quantity}개 · {order.total.toLocaleString('ko-KR')} P
                    </p>
                  </div>
                  <span className={`order-status order-status-${order.status}`}>{statusLabels[order.status]}</span>
                  {order.status === 'pending' && (
                    <button
                      className="button button-outline button-small"
                      disabled={busy}
                      onClick={() => cancel(order)}
                    >
                      신청 취소
                    </button>
                  )}
                </article>
              ))}
            </div>
            <nav className="market-pagination" aria-label="교환 내역 페이지">
              <button disabled={orders.data.page <= 1} onClick={() => setParams({page: String(orders.data!.page - 1)})}>
                이전
              </button>
              <span>
                {orders.data.page} / {Math.max(1, Math.ceil(orders.data.total / orders.data.pageSize))}
              </span>
              <button
                disabled={orders.data.page * orders.data.pageSize >= orders.data.total}
                onClick={() => setParams({page: String(orders.data!.page + 1)})}
              >
                다음
              </button>
            </nav>
          </>
        ) : (
          <EmptyState title="아직 교환 내역이 없어요" description="포인트 마켓에서 크루를 위한 상품을 만나보세요." />
        )}
      </section>
    </div>
  );
}
