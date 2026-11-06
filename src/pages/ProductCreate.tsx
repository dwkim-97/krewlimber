import {ArrowLeft} from 'lucide-react';
import {useEffect, useRef} from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {ProductForm} from '@/components/ProductForm';
import {ErrorNotice, Loading, PageHeading} from '@/components/ui';
import {useResource} from '@/hooks/useResource';
import type {Product} from '@/types/boards';

export function ProductCreate() {
  return <ProductEditor product={null} />;
}
export function ProductEdit() {
  const {id} = useParams();
  return id ? <ExistingProductEditor key={id} id={id} /> : null;
}
function ExistingProductEditor({id}: {id: string}) {
  const resource = useResource<{product: Product}>(`/admin/market/products/${encodeURIComponent(id)}`);
  return (
    <>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <div className="page-shell">
          <ErrorNotice message={resource.error} retry={resource.reload} />
        </div>
      ) : resource.data ? (
        <ProductEditor
          key={`${resource.data.product.id}:${resource.data.product.revision}`}
          product={resource.data.product}
        />
      ) : null}
    </>
  );
}
function ProductEditor({product}: {product: Product | null}) {
  const navigate = useNavigate();
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  return (
    <div className="page-shell market-page market-create-page">
      <PageHeading title={product ? '상품 수정' : '상품 등록'}>
        <Link className="text-link" to="/market">
          <ArrowLeft size={17} /> 마켓으로
        </Link>
      </PageHeading>
      <ProductForm
        product={product}
        onCancel={() => navigate('/market')}
        onSaved={() => {
          if (active.current)
            navigate('/market', {replace: true, state: product ? {productUpdated: true} : {productCreated: true}});
        }}
      />
    </div>
  );
}
