import {
  ArrowLeft,
  ArrowUpRight,
  Backpack,
  Coins,
  Gift,
  Pencil,
  Plus,
  Search,
  Shirt,
  ShoppingBag,
  Ticket,
} from 'lucide-react';
import {useRef, useState, type FormEvent} from 'react';
import {Link, useLocation, useParams, useSearchParams} from 'react-router-dom';
import {EmptyState, ErrorNotice, Loading, PageHeading} from '@/components/ui';
import {useResource} from '@/hooks/useResource';
import {useSession} from '@/hooks/useSession';
import {api, ApiRequestError} from '@/apis/client';
import type {MarketOrder, Page, Product, ProductCategory, Wallet} from '@/types/boards';
import '@/styles/market.css';

const categories: {id: ProductCategory | ''; label: string}[] = [
  {id: '', label: '전체'},
  {id: 'gear', label: '클라이밍 용품'},
  {id: 'apparel', label: '크루 의류'},
  {id: 'voucher', label: '이용권'},
  {id: 'other', label: '기타'},
];

function ProductVisual({product}: {product: Product}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const Icon = {gear: Backpack, apparel: Shirt, voucher: Ticket, other: Gift}[product.category];
  return (
    <div className={`product-visual product-visual-${product.category}`}>
      {product.imageUrl && failedUrl !== product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(product.imageUrl)}
        />
      ) : (
        <>
          <span className="product-visual-ring" />
          <Icon size={88} strokeWidth={1.2} />
          <span className="product-visual-word">KREW / GOODS</span>
        </>
      )}
    </div>
  );
}

export function Market() {
  const {user} = useSession();
  const {state} = useLocation();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const products = useResource<Page<Product>>(
    `/market/products?${new URLSearchParams({q, category: category || 'all', page: String(page)})}`
  );
  const wallet = useResource<Wallet>('/me/wallet');
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setParams({q: String(form.get('q') ?? '').trim(), category, page: '1'});
  }
  return (
    <div className="page-shell market-page">
      <PageHeading title="포인트 마켓">
        <div className="market-heading-actions">
          <Link className="text-link" to="/me/orders">
            내 교환 내역 <ArrowUpRight size={17} />
          </Link>
          {user?.role === 'admin' && user.status === 'approved' && (
            <Link className="button button-dark button-small" to="/market/new">
              <Plus size={17} /> 상품 등록
            </Link>
          )}
        </div>
      </PageHeading>
      {state?.productCreated === true && (
        <div className="notice success" role="status">
          상품을 등록했습니다.
        </div>
      )}
      {state?.productUpdated === true && (
        <div className="notice success" role="status">
          상품을 수정했습니다.
        </div>
      )}
      <section className="market-intro">
        <div>
          <span className="market-eyebrow">CLIMB TOGETHER, GET MORE.</span>
          <h2>
            크루의 일상에
            <br />
            작은 보상을 더해요.
          </h2>
          <p>모은 포인트로 만나는 크루 굿즈와 클라이밍 용품.</p>
        </div>
        <div className="market-wallet">
          <Coins size={24} />
          <span>내 포인트</span>
          <strong>
            {wallet.loading
              ? '조회 중'
              : wallet.error
                ? '조회 실패'
                : `${wallet.data?.balance.toLocaleString('ko-KR')} P`}
          </strong>
          <Link to="/me/orders">
            포인트 내역 <ArrowUpRight size={14} />
          </Link>
        </div>
      </section>
      {wallet.error && <ErrorNotice message={wallet.error} retry={wallet.reload} />}
      <div className="market-toolbar">
        <div className="market-categories" aria-label="상품 카테고리">
          {categories.map(item => (
            <button
              key={item.id}
              className={category === item.id ? 'active' : ''}
              onClick={() => setParams({q, category: item.id, page: '1'})}
            >
              {item.label}
            </button>
          ))}
        </div>
        <form className="market-search" onSubmit={search}>
          <input
            key={q}
            name="q"
            defaultValue={q}
            aria-label="상품 검색"
            placeholder="어떤 상품을 찾으세요?"
            maxLength={100}
          />
          <button aria-label="검색">
            <Search size={19} />
          </button>
        </form>
      </div>
      {products.loading ? (
        <Loading />
      ) : products.error ? (
        <ErrorNotice message={products.error} retry={products.reload} />
      ) : products.data?.items.length ? (
        <>
          <p className="market-count">총 {products.data.total}개의 상품</p>
          <div className="product-grid">
            {products.data.items.map(product => (
              <Link className="product-card" key={product.id} to={`/market/${product.id}`}>
                <div className="product-image-wrap">
                  <ProductVisual product={product} />
                  {product.stock === 0 && <span className="product-soldout">품절</span>}
                </div>
                <div className="product-card-info">
                  <span className="product-category-label">
                    {categories.find(item => item.id === product.category)?.label}
                  </span>
                  <h3>{product.name}</h3>
                  <div>
                    <strong>
                      {product.points.toLocaleString('ko-KR')} <small>P</small>
                    </strong>
                    <span>{product.stock > 0 ? `재고 ${product.stock}개` : '입고 준비 중'}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <nav className="market-pagination" aria-label="상품 페이지">
            <button
              disabled={products.data.page <= 1}
              onClick={() => setParams({q, category, page: String(products.data!.page - 1)})}
            >
              이전
            </button>
            <span>
              {products.data.page} / {Math.max(1, Math.ceil(products.data.total / products.data.pageSize))}
            </span>
            <button
              disabled={products.data.page * products.data.pageSize >= products.data.total}
              onClick={() => setParams({q, category, page: String(products.data!.page + 1)})}
            >
              다음
            </button>
          </nav>
        </>
      ) : (
        <EmptyState
          title={q ? '검색 결과가 없어요' : '상품을 준비하고 있어요'}
          description={q ? '다른 검색어나 카테고리를 선택해보세요.' : '크루를 위한 새로운 상품을 곧 만나보세요.'}
        >
          <ShoppingBag size={24} />
        </EmptyState>
      )}
    </div>
  );
}

export function ProductDetail() {
  const {id} = useParams();
  return id ? <ProductDetailContent key={id} id={id} /> : null;
}

function ProductDetailContent({id}: {id: string}) {
  const {user} = useSession();
  const product = useResource<{product: Product}>(`/market/products/${id}`);
  const wallet = useResource<Wallet>('/me/wallet');
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<MarketOrder | null>(null);
  const request = useRef<{productId: string; quantity: number; productRevision: number; requestId: string} | null>(
    null
  );
  const submitting = useRef(false);
  const item = product.data?.product;
  const total = (item?.points ?? 0) * quantity;
  const canRedeem =
    item &&
    item.active &&
    item.stock >= quantity &&
    wallet.data &&
    wallet.data.balance >= total &&
    !wallet.loading &&
    !wallet.error;
  async function redeem() {
    if (submitting.current || !item || !canRedeem) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    setOrder(null);
    if (!request.current)
      request.current = {productId: id, quantity, productRevision: item.revision, requestId: crypto.randomUUID()};
    try {
      const result = await api<{order: MarketOrder}>('/market/orders', {
        method: 'POST',
        body: JSON.stringify(request.current),
      });
      setOrder(result.order);
      request.current = null;
      wallet.reload();
      product.reload();
    } catch (error) {
      if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) {
        request.current = null;
        product.reload();
        wallet.reload();
      }
      setError(
        error instanceof Error ? error.message : '신청 결과를 확인하지 못했습니다. 같은 수량으로 다시 시도해주세요.'
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="page-shell market-page">
      <div className="market-detail-actions">
        <Link to="/market" className="text-link market-back">
          <ArrowLeft size={17} /> 마켓으로
        </Link>
        {user?.role === 'admin' && user.status === 'approved' && (
          <Link className="button button-outline button-small" to={`/market/${id}/edit`}>
            <Pencil size={16} /> 상품 수정
          </Link>
        )}
      </div>
      {product.loading ? (
        <Loading />
      ) : product.error ? (
        <ErrorNotice message={product.error} retry={product.reload} />
      ) : item ? (
        <>
          <div className="product-detail">
            <ProductVisual key={item.id} product={item} />
            <div className="product-detail-info">
              <span className="market-eyebrow">KREW SELECT</span>
              <h1>{item.name}</h1>
              <p className="product-description">{item.description}</p>
              <strong className="product-detail-price">
                {item.points.toLocaleString('ko-KR')} <small>P</small>
              </strong>
              <div className="product-purchase">
                <p>
                  <span>내 포인트</span>
                  <strong>
                    {wallet.loading
                      ? '조회 중'
                      : wallet.error
                        ? '조회 실패'
                        : `${wallet.data?.balance.toLocaleString('ko-KR')} P`}
                  </strong>
                </p>
                <p>
                  <span>재고</span>
                  <span>{item.stock}개</span>
                </p>
                <label className="market-quantity">
                  수량
                  <select
                    aria-label="수량"
                    value={quantity}
                    disabled={busy}
                    onChange={event => {
                      const next = Number(event.target.value);
                      setQuantity(next);
                      request.current = null;
                      setOrder(null);
                      setError('');
                    }}
                  >
                    {Array.from({length: 20}, (_, index) => (
                      <option key={index} value={index + 1}>
                        {index + 1}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="product-total">
                  <span>총 포인트</span>
                  <strong>{total.toLocaleString('ko-KR')} P</strong>
                </p>
                <button className="button button-dark" disabled={busy || !canRedeem} onClick={redeem}>
                  {busy
                    ? '신청 중…'
                    : !item.active
                      ? '판매 중지'
                      : item.stock < quantity
                        ? '재고 부족'
                        : !wallet.loading && wallet.data && wallet.data.balance < total
                          ? '포인트 부족'
                          : '교환 신청'}
                  <ArrowUpRight size={18} />
                </button>
              </div>
              <p className="market-policy">
                신청 즉시 포인트와 재고가 차감돼요. 처리 대기 중 취소하면 전액 반환되며, 완료 후에는 취소할 수 없어요.
              </p>
            </div>
          </div>
          {order && (
            <div className="notice success" role="status">
              <div>
                <strong>교환을 신청했어요.</strong>
                <p>
                  {order.productName} · {order.quantity}개 · {order.total.toLocaleString('ko-KR')} P
                </p>
                <Link className="text-link" to="/me/orders">
                  교환 내역 보기 <ArrowUpRight size={15} />
                </Link>
              </div>
            </div>
          )}
          {error && <ErrorNotice message={error} retry={null} />}
          {wallet.error && <ErrorNotice message={wallet.error} retry={wallet.reload} />}
        </>
      ) : null}
    </div>
  );
}
