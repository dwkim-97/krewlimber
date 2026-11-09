import {Check} from 'lucide-react';
import {useEffect, useRef, useState, type ChangeEvent, type FormEvent} from 'react';
import {ErrorNotice} from '@/components/ui';
import {api} from '@/apis/client';
import type {Product, ProductCategory, ProductInput} from '@/types/boards';
import '@/styles/market.css';

const categories: {id: ProductCategory; label: string}[] = [
  {id: 'gear', label: '클라이밍 용품'},
  {id: 'apparel', label: '크루 의류'},
  {id: 'voucher', label: '이용권'},
  {id: 'other', label: '기타'},
];
const blankProduct: ProductInput = {
  name: '',
  description: '',
  imageUrl: null,
  category: 'gear',
  points: 1,
  stock: 0,
  active: true,
};

export function ProductForm({
  product,
  onSaved,
  onCancel,
}: {
  product: Product | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<ProductInput>(product ?? blankProduct);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState<{file: File; url: string} | null>(null);
  const uploaded = useRef<{file: File; imageUrl: string} | null>(null);
  useEffect(
    () => () => {
      if (selection) URL.revokeObjectURL(selection.url);
    },
    [selection]
  );
  function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('JPG, PNG, WebP 이미지를 선택해주세요.');
      event.currentTarget.value = '';
      return;
    }
    if (file.size === 0 || file.size > 4 * 1024 * 1024) {
      setError('이미지는 4MB 이하의 파일로 선택해주세요.');
      event.currentTarget.value = '';
      return;
    }
    uploaded.current = null;
    setSelection({file, url: URL.createObjectURL(file)});
    setError('');
  }
  function removeImage() {
    setSelection(null);
    uploaded.current = null;
    setValue({...value, imageUrl: null});
    if (imageInput.current) imageInput.current.value = '';
  }
  const preview = selection?.url ?? value.imageUrl;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    const input: ProductInput = {
      name: value.name.trim(),
      description: value.description.trim(),
      imageUrl: value.imageUrl?.trim() || null,
      category: value.category,
      points: value.points,
      stock: value.stock,
      active: value.active,
    };
    try {
      if (selection) {
        if (uploaded.current?.file !== selection.file) {
          const result = await api<{imageUrl: string}>('/admin/market/images', {
            method: 'POST',
            headers: {'Content-Type': selection.file.type},
            body: selection.file,
          });
          uploaded.current = {file: selection.file, imageUrl: result.imageUrl};
        }
        input.imageUrl = uploaded.current.imageUrl;
      }
      await api(product ? `/admin/market/products/${product.id}` : '/admin/market/products', {
        method: product ? 'PATCH' : 'POST',
        body: JSON.stringify(product ? {...input, revision: product.revision} : input),
      });
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : '상품을 저장하지 못했습니다.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="form-panel market-editor">
      {error && <ErrorNotice message={error} retry={null} />}
      <form onSubmit={save}>
        <fieldset className="product-fields" disabled={busy}>
          <div className="form-grid">
            <label>
              상품 이름
              <input
                required
                maxLength={80}
                value={value.name}
                onChange={event => setValue({...value, name: event.target.value})}
              />
            </label>
            <label>
              카테고리
              <select
                value={value.category}
                onChange={event => setValue({...value, category: event.target.value as ProductCategory})}
              >
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              포인트 가격
              <input
                type="number"
                min={1}
                max={1000000}
                step={1}
                required
                value={value.points}
                onChange={event => setValue({...value, points: event.target.valueAsNumber})}
              />
            </label>
            <label>
              재고
              <input
                type="number"
                min={0}
                max={1000000}
                step={1}
                required
                value={value.stock}
                onChange={event => setValue({...value, stock: event.target.valueAsNumber})}
              />
            </label>
          </div>
          <div className="product-image-input">
            <label>
              상품 이미지
              <input
                ref={imageInput}
                aria-label="상품 이미지"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={selectImage}
              />
              <small>JPG, PNG, WebP · 최대 4MB</small>
            </label>
            {preview && (
              <div className="product-image-preview">
                <img src={preview} alt="상품 이미지 미리보기" referrerPolicy="no-referrer" />
                <button type="button" className="text-button" onClick={removeImage}>
                  이미지 제거
                </button>
              </div>
            )}
            <details>
              <summary>이미지 주소 사용</summary>
              <label>
                이미지 주소
                <input
                  placeholder="https:// 또는 /images/…"
                  maxLength={2000}
                  disabled={selection !== null}
                  value={value.imageUrl ?? ''}
                  onChange={event => setValue({...value, imageUrl: event.target.value || null})}
                />
              </label>
            </details>
          </div>
          <label>
            상품 설명
            <textarea
              rows={4}
              maxLength={2000}
              value={value.description}
              onChange={event => setValue({...value, description: event.target.value})}
            />
          </label>
          <label>
            판매 상태
            <select
              value={String(value.active)}
              onChange={event => setValue({...value, active: event.target.value === 'true'})}
            >
              <option value="true">판매 중</option>
              <option value="false">판매 중지</option>
            </select>
          </label>
          <div className="form-footer">
            <button type="button" className="button button-outline button-small" disabled={busy} onClick={onCancel}>
              취소
            </button>
            <button className="button button-dark button-small" disabled={busy}>
              {busy ? '저장 중…' : product ? '상품 저장' : '상품 등록'} <Check size={16} />
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
