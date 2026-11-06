import {ArrowLeft} from 'lucide-react';
import {useEffect, useRef} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {ProductForm} from '@/components/ProductForm';
import {PageHeading} from '@/components/ui';

export function ProductCreate() {
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
      <PageHeading title="상품 등록">
        <Link className="text-link" to="/market">
          <ArrowLeft size={17} /> 마켓으로
        </Link>
      </PageHeading>
      <ProductForm
        product={null}
        onCancel={() => navigate('/market')}
        onSaved={() => {
          if (active.current) navigate('/market', {replace: true, state: {productCreated: true}});
        }}
      />
    </div>
  );
}
